import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterProductDto } from './dto/filter-product.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) { }

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
        description: dto.description,
        category_id: dto.category_id,
        start_price: dto.start_price,
        current_price: dto.start_price,
        step_price: dto.step_price,
        buy_now_price: dto.buy_now_price,
        start_time: new Date(),
        end_time: new Date(dto.end_time),
        product_images: {
          create: dto.images.map((url, index) => ({
            url: url,
            is_primary: index === 0,
          })),
        },
      },
      include: {
        product_images: true,
      },
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
      SELECT p.*, u.full_name as bidder_name,
        (SELECT COUNT(*) FROM bids b WHERE b.product_id = p.id) as bid_count,
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
}
