import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterProductDto } from './dto/filter-product.dto';

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

    const whereCondition: any = {
      status: 'ACTIVE',
    }

    if (query.search) {
      whereCondition.name = {
        contains: query.search,
        mode: 'insensitive',
      }
    }

    if (query.category_id) {
      whereCondition.category_id = Number(query.category_id)
    }

    const [products, total] = await Promise.all([
      this.prisma.products.findMany({
        where: whereCondition,
        skip: skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          product_images: {
            where: { is_primary: true },
            take: 1
          },
          categories: { select: { name: true } }
        }
      }),
      this.prisma.products.count({ where: whereCondition })
    ]);

    return {
      data: products,
      total,
      page,
      limit,
    }
  }

  async findOne(id: number) {
    const product = await this.prisma.products.findUnique({
      where: { id: id },
      include: {
        product_images: true,
        users_products_seller_idTousers: {
          select: { id: true, full_name: true, rating_score: true }
        },
        categories: true,
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

    // increase product view count
    await this.prisma.products.update({ where: { id }, data: { view_count: { increment: 1 } } });

    return product;
  }
}
