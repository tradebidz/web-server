import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterProductDto } from './dto/filter-product.dto';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { BanBidderDto } from './dto/ban-bidder.dto';
import { NotificationService } from 'src/notification/notification.service';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { Inject } from '@nestjs/common';

@Injectable()
export class ProductsService {

  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notificationService: NotificationService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: WinstonLogger,
  ) {
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

    this.logger.log(
      'Create Product Success',
      JSON.stringify({
        productId: newProduct.id,
        productName: newProduct.name,
        price: newProduct.start_price,
        sellerId: userId,
      }),
    );

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
      whereSql = Prisma.sql`${whereSql} AND p.category_id IN (
        WITH RECURSIVE category_tree AS (
          SELECT id FROM categories WHERE id = ${Number(query.category_id)}
          UNION ALL
          SELECT c.id FROM categories c
          INNER JOIN category_tree ct ON c.parent_id = ct.id
        )
        SELECT id FROM category_tree
      )`
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
        c.name as category_name,
        seller.full_name as seller_name,
        seller.rating_score as seller_rating_score,
        seller.rating_count as seller_rating_count,
        winner.full_name as winner_name,
        (SELECT u.full_name FROM bids b JOIN users u ON b.bidder_id = u.id WHERE b.product_id = p.id AND b.status = 'VALID' ORDER BY b.amount DESC LIMIT 1) as current_bidder_name,
        (SELECT COUNT(*)::int FROM bids b WHERE b.product_id = p.id) as bid_count,
        (CASE WHEN p.created_at > ${timeThreshold} THEN true ELSE false END) as is_new
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users seller ON p.seller_id = seller.id
      LEFT JOIN users winner ON p.winner_id = winner.id
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
          id: p.id,
          seller_id: p.seller_id,
          category_id: p.category_id,
          name: p.name,
          thumbnail: img?.url,
          description: p.description,
          start_price: p.start_price,
          current_price: p.current_price,
          step_price: p.step_price,
          buy_now_price: p.buy_now_price,
          start_time: p.start_time,
          end_time: p.end_time,
          is_auto_extend: p.is_auto_extend,
          status: p.status,
          winner_id: p.winner_id,
          view_count: p.view_count,
          bid_count: p.bid_count,
          is_new: p.is_new,
          created_at: p.created_at,
          updated_at: p.updated_at,
          category: p.category_name ? {
            id: p.category_id,
            name: p.category_name
          } : null,
          seller: p.seller_name ? {
            id: p.seller_id,
            full_name: p.seller_name,
            rating_score: p.seller_rating_score,
            rating_count: p.seller_rating_count
          } : null,
          winner: p.winner_name ? {
            id: p.winner_id,
            full_name: p.winner_name
          } : null,
          current_bidder_name: p.current_bidder_name,
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
    const products = await this.prisma.products.findMany({
      where: { status: 'ACTIVE', end_time: { gt: new Date() } },
      orderBy: { end_time: 'asc' },
      take: 5,
      include: {
        product_images: { where: { is_primary: true } },
        categories: { select: { id: true, name: true } },
        users_products_seller_idTousers: {
          select: { id: true, full_name: true, rating_score: true, rating_count: true }
        },
        users_products_winner_idTousers: {
          select: { id: true, full_name: true }
        },
        _count: { select: { bids: true } },
        bids: {
          where: { status: 'VALID' },
          orderBy: { amount: 'desc' },
          take: 1,
          include: { users: { select: { full_name: true } } }
        }
      }
    });

    return products.map(p => ({
      ...p,
      bid_count: p._count.bids,
      current_bidder_name: p.bids[0]?.users?.full_name
    }));
  }

  async getTopBidding() {
    const products = await this.prisma.products.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { bids: { _count: 'desc' } },
      take: 5,
      include: {
        product_images: { where: { is_primary: true } },
        categories: { select: { id: true, name: true } },
        users_products_seller_idTousers: {
          select: { id: true, full_name: true, rating_score: true, rating_count: true }
        },
        users_products_winner_idTousers: {
          select: { id: true, full_name: true }
        },
        _count: { select: { bids: true } },
        bids: {
          where: { status: 'VALID' },
          orderBy: { amount: 'desc' },
          take: 1,
          include: { users: { select: { full_name: true } } }
        }
      }
    });

    return products.map(p => ({
      ...p,
      bid_count: p._count.bids,
      current_bidder_name: p.bids[0]?.users?.full_name
    }));
  }

  async getTopPrice() {
    const products = await this.prisma.products.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { current_price: 'desc' },
      take: 5,
      include: {
        product_images: { where: { is_primary: true } },
        categories: { select: { id: true, name: true } },
        users_products_seller_idTousers: {
          select: { id: true, full_name: true, rating_score: true, rating_count: true }
        },
        users_products_winner_idTousers: {
          select: { id: true, full_name: true }
        },
        _count: { select: { bids: true } },
        bids: {
          where: { status: 'VALID' },
          orderBy: { amount: 'desc' },
          take: 1,
          include: { users: { select: { full_name: true } } }
        }
      }
    });

    return products.map(p => ({
      ...p,
      bid_count: p._count.bids,
      current_bidder_name: p.bids[0]?.users?.full_name
    }));
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

  async getSellerBids(userId: number, productId: number) {
    const product = await this.prisma.products.findUnique({ where: { id: productId } });
    if (!product) throw new BadRequestException('Product not found');
    if (product.seller_id !== userId) throw new ForbiddenException('Only seller can view bid history');

    // Fetch all bids for this product with user info
    // We want to see all bids to manage them (e.g. kick bad bidders)
    const bids = await this.prisma.bids.findMany({
      where: { product_id: productId },
      orderBy: { amount: 'desc' },
      include: {
        users: {
          select: {
            id: true,
            full_name: true,
            rating_score: true
          }
        }
      }
    });

    // Map to a cleaner format if desired, or return as is.
    // Let's add 'bidder_name' for convenience in frontend
    return bids.map(bid => ({
      ...bid,
      bidder_id: bid.bidder_id,
      bidder_name: bid.users?.full_name || "Unknown",
      rating_score: bid.users?.rating_score || 0
    }));
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

    const productLink = `http://localhost:5173/product/${productId}`;

    await this.notificationService.sendNewQuestionEmail(
      productName,
      sellerEmail,
      content,
      productLink,
    );
  }

  async appendDescription(userId: number, productId: number, content: string) {
    const product = await this.prisma.products.findUnique({ where: { id: productId } });

    if (!product) throw new NotFoundException('Product not found');
    if (product.seller_id !== userId) throw new ForbiddenException("Only seller can append description");

    const now = new Date();
    // Use a clean separator for the appended description
    const timestamp = now.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    const separator = `<br/><br/><div style="border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px;">
      <strong>Mô tả bổ sung (${timestamp}):</strong><br/>
      ${content}
    </div>`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the detailed record in product_descriptions
      const descriptionRecord = await tx.product_descriptions.create({
        data: {
          product_id: productId,
          content: content,
          created_at: now
        }
      });

      // 2. Update the main products table to include the addition in the main description field
      await tx.products.update({
        where: { id: productId },
        data: {
          description: (product.description || '') + separator,
          updated_at: now
        }
      });

      return descriptionRecord;
    });
  }

  async banBidder(sellerId: number, productId: number, dto: BanBidderDto) {
    const product = await this.prisma.products.findUnique({ where: { id: productId } });

    if (product?.seller_id !== sellerId) throw new ForbiddenException("Only seller can ban bidder");

    // Get bidder email before banning
    const bidder = await this.prisma.users.findUnique({
      where: { id: dto.bidderId },
      select: { email: true }
    });

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

    // Send rejection email
    if (bidder?.email) {
      await this.notificationService.sendBidRejectedEmail(
        product.name,
        bidder.email,
        dto.reason,
      );
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

    const updatedQuestion = await this.prisma.product_questions.update({
      where: { id: questionId },
      data: {
        answer: answer,
        answered_at: new Date()
      }
    });

    // Get all bidders' emails for this product
    const bidders = await this.prisma.bids.findMany({
      where: {
        product_id: question.product_id,
        status: 'VALID'
      },
      include: { users: { select: { email: true } } },
      distinct: ['bidder_id']
    });

    const bidderEmails = bidders
      .map(bid => bid.users?.email)
      .filter((email): email is string => email !== null && email !== undefined);

    if (bidderEmails.length > 0) {
      await this.notificationService.sendNewAnswerEmail(
        question.products?.name || 'Product',
        question.question,
        answer,
        bidderEmails,
      );
    }

    return updatedQuestion;
  }
}
