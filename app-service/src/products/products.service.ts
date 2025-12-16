import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterProductDto } from './dto/filter-product.dto';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { BanBidderDto } from './dto/ban-bidder.dto';

@Injectable()
export class ProductsService {

  private redis: Redis;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST') || 'localhost',
      port: this.config.get('REDIS_PORT') || 6379,
    });
  }

  async createProduct(userId: number, dto: CreateProductDto) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) throw new ForbiddenException('User not found')
    if (user.role !== 'SELLER' && user.role !== 'ADMIN') throw new ForbiddenException('You are not allowed to create a product')

    const newProduct = await this.prisma.products.create({
      data: {
        seller_id: userId,
        name: dto.name,
        category_id: dto.category_id,
        start_price: dto.start_price,
        current_price: dto.start_price,
        step_price: dto.step_price,
        buy_now_price: dto.buy_now_price,
        description: dto.description,
        start_time: new Date(),
        end_time: dto.end_time,
        is_auto_extend: dto.is_auto_extend ?? true,
        product_images: {
          create: dto.images.map((url, idx) => ({
            url,
            is_primary: idx === 0
          }))
        }
      }
    });

    return newProduct;
  }

  async findAll(query: FilterProductDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const N_MINUTES = 60;
    const timeThreshold = new Date(Date.now() - N_MINUTES * 60000);

    let whereSql = Prisma.sql`WHERE p.status = 'ACTIVE'`;

    if (query.search) {
      const searchKey = query.search.trim().toLowerCase();
      whereSql = Prisma.sql`${whereSql} AND p.search_vector @@ plainto_tsquery('simple', unaccent(${searchKey}))`
    }

    if (query.category_id) {
      whereSql = Prisma.sql`${whereSql} AND p.category_id = ${Number(query.category_id)}`
    }

    let orderBySql = Prisma.sql`ORDER BY p.created_at DESC`;
    if (query.sort === 'time_desc') {
      orderBySql = Prisma.sql`ORDER BY p.end_time DESC`
    } else if (query.sort === 'price_asc') {
      orderBySql = Prisma.sql`ORDER BY p.current_price ASC`
    }

    const products = await this.prisma.$queryRaw`
      SELECT 
        p.id, p.seller_id, p.category_id, p.name, p.thumbnail, p.description,
        p.start_price, p.current_price, p.step_price, p.buy_now_price,
        p.start_time, p.end_time, p.is_auto_extend, p.status, p.winner_id,
        p.view_count, p.created_at, p.updated_at,
        u.full_name as bidder_name,
        (SELECT COUNT(*)::int FROM bids b WHERE b.product_id = p.id) as bid_count,
        (CASE WHEN p.created_at > ${timeThreshold} THEN true ELSE false END) as is_new
      FROM products p
      LEFT JOIN users u ON p.winner_id = u.id
      ${whereSql}
      ${orderBySql}
      LIMIT ${limit} OFFSET ${skip}
      `;

    const enrichedProducts = await Promise.all(
      (products as any[]).map(async (p) => {
        const img = await this.prisma.product_images.findFirst({
          where: { product_id: p.id, is_primary: true },
        });

        return {
          ...p,
          thumbnail: img?.url,
        }
      })
    );

    const totalRaw = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM products p ${whereSql}
      `

    const total = (totalRaw as any[])[0].count;

    return {
      data: enrichedProducts,
      total,
      page,
      limit,
      last_page: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const product = await this.prisma.products.findUnique({
      where: { id: id },
      include: {
        product_images: true,
        users_products_seller_idTousers: {
          select: { id: true, full_name: true, rating_score: true, rating_count: true }
        },
        categories: true,
        product_questions: {
          include: { users: { select: { full_name: true } } }
        },
        bids: {
          orderBy: { amount: 'desc' },
          take: 5,
          include: {
            users: { select: { full_name: true } }
          }
        }
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    const relatedProducts = await this.prisma.products.findMany({
      where: { category_id: product.category_id, id: { not: id }, status: 'ACTIVE' },
      take: 5,
      include: { product_images: { where: { is_primary: true } } }
    });

    // increase product view count
    await this.prisma.products.update({ where: { id }, data: { view_count: { increment: 1 } } });

    return {
      ...product,
      related_products: relatedProducts,
    };
  }

  async getTopEnding() {
    return this.prisma.products.findMany({
      where: { status: 'ACTIVE', end_time: { gt: new Date() } },
      orderBy: { end_time: 'asc' },
      take: 5,
      include: { product_images: { where: { is_primary: true } } }
    });
  }

  async getTopBidding() {
    return this.prisma.products.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { bids: { _count: 'desc' } },
      take: 5,
      include: { product_images: { where: { is_primary: true } } }
    });
  }

  async getTopPrice() {
    return this.prisma.products.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { current_price: 'desc' },
      take: 5,
      include: { product_images: { where: { is_primary: true } } }
    });
  }

  async validateBidEligibility(userId: number, productId: number) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    const product = await this.prisma.products.findUnique({ where: { id: productId } });

    if (!product) throw new BadRequestException('Product not found');
    if (product.status !== 'ACTIVE') throw new BadRequestException('Product has been ended');

    const totalFeedback = await this.prisma.feedbacks.count({
      where: { to_user_id: userId }
    });

    if (totalFeedback === 0) {
      return { eligible: true, message: "New bidder allowed" };
    }

    const positiveFeedback = await this.prisma.feedbacks.count({
      where: { to_user_id: userId, score: { gte: 0 } }
    });

    const ratio = positiveFeedback / totalFeedback;

    if (ratio < 0.8) {
      throw new ForbiddenException(`Low credibility score (${(ratio * 100).toFixed(1)}%). Require at least 80% to bid`);
    }

    return { eligible: true, message: "Bidder allowed" };
  }

  async getSuggestedPrice(productId: number) {
    const product = await this.prisma.products.findUnique({ where: { id: productId } });
    if (!product) throw new BadRequestException('Product not found');

    const nextPrice = product.current_price?.equals(0) ? product.start_price : Number(product.current_price) + Number(product.step_price);

    return { suggested_price: nextPrice };
  }

  async getBidHistory(productId: number) {
    const bids = await this.prisma.bids.findMany({
      where: { product_id: productId },
      orderBy: { time: 'desc' },
      include: {
        users: { select: { full_name: true } }
      }
    });

    const maskedBids = bids.map(bid => {
      const fullName = bid.users?.full_name || "Unknown";
      const parts = fullName.trim().split(' ');
      const lastName = parts[parts.length - 1];

      return {
        id: bid.id,
        time: bid.time,
        amount: bid.amount,
        bidder_name: `**** ${lastName}`
      }
    });

    return maskedBids;
  }

  async createQuestion(userId: number, productId: number, content: string) {
    const question = await this.prisma.product_questions.create({
      data: {
        user_id: userId,
        product_id: productId,
        question: content
      },
      include: {
        products: { include: { users_products_seller_idTousers: true } }
      }
    });

    const sellerEmail = question.products?.users_products_seller_idTousers?.email;
    const productName = question.products?.name;

    if (!sellerEmail || !productName) throw new BadRequestException('Invalid product or seller');

    const productLink = `http://localhost:5173/products/${productId}`;

    await this.redis.xadd('notification_stream', '*',
      'type', 'NEW_QUESTION',
      'email', sellerEmail,
      'subject', `New question for product: ${productName}`,
      'content', `You have new question: "${content}". <br> <a href="${productLink}">Reply now</a>`,
      'created_at', new Date().toISOString(),
    )
  }

  async appendDescription(userId: number, productId: number, content: string) {
    const product = await this.prisma.products.findUnique({ where: { id: productId } });

    if (product?.seller_id !== userId) throw new ForbiddenException("Only seller can append description");

    return this.prisma.product_descriptions.create({
      data: {
        product_id: productId,
        content: content
      }
    });
  }

  async banBidder(sellerId: number, productId: number, dto: BanBidderDto) {
    const product = await this.prisma.products.findUnique({ where: { id: productId } });

    if (product?.seller_id !== sellerId) throw new ForbiddenException("Only seller can ban bidder");

    await this.prisma.banned_bidders.create({
      data: {
        product_id: productId,
        user_id: dto.bidderId,
        reason: dto.reason
      }
    });

    // reject all bids from banned bidder
    await this.prisma.bids.updateMany({
      where: { product_id: productId, bidder_id: dto.bidderId },
      data: { status: 'REJECTED' }
    });

    // re-calculate next highest bid
    const nextHighestBid = await this.prisma.bids.findFirst({
      where: { product_id: productId, status: 'VALID' },
      orderBy: { amount: 'desc' }
    });

    if (nextHighestBid) {
      await this.prisma.products.update({
        where: { id: productId },
        data: {
          current_price: nextHighestBid.amount,
          winner_id: nextHighestBid.bidder_id
        }
      });
    } else {
      await this.prisma.products.update({
        where: { id: productId },
        data: {
          current_price: product.start_price,
          winner_id: null
        }
      });
    }

    return { message: 'Bidder banned successfully' };
  }

  async answerQuestion(sellerId: number, questionId: number, answer: string) {
    const question = await this.prisma.product_questions.findUnique({
      where: { id: questionId },
      include: { products: true }
    });

    if (!question || question?.products?.seller_id !== sellerId) {
      throw new ForbiddenException("Only seller can answer question");
    }

    return this.prisma.product_questions.update({
      where: { id: questionId },
      data: {
        answer: answer,
        answered_at: new Date()
      }
    });
  }
}
