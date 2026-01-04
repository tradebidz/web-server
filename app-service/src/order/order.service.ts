import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OrderService {
    constructor(private prisma: PrismaService) { }

    async createOrder(userId: number, productId: number) {
        const product = await this.prisma.products.findUnique({ where: { id: productId } });
        if (!product) throw new BadRequestException('Product not found');

        if (product.winner_id !== userId) {
            throw new ForbiddenException('You are not the winner of this product');
        }

        if (!product.seller_id || !product.current_price) {
            throw new BadRequestException('Product not found');
        }

        const existingOrder = await this.prisma.orders.findUnique({
            where: { product_id: productId }
        });

        if (existingOrder) {
            return existingOrder;
        }

        return this.prisma.orders.create({
            data: {
                product_id: productId,
                buyer_id: userId,
                seller_id: product.seller_id,
                amount: product.current_price,
                status: 'PENDING',
                payment_status: 'UNPAID'
            }
        });
    }

    async getOrder(userId: number, orderId: number) {
        const order = await this.prisma.orders.findUnique({
            where: { id: orderId },
            include: {
                products: { include: { product_images: true } },
                seller: { select: { id: true, full_name: true, email: true } },
                buyer: { select: { id: true, full_name: true, email: true } }
            }
        });

        if (!order) throw new BadRequestException('Đơn hàng không tồn tại');

        if (order.buyer_id !== userId && order.seller_id !== userId) {
            throw new ForbiddenException('Không có quyền xem đơn hàng này');
        }

        return order;
    }

    async getOrders(userId: number) {
        return this.prisma.orders.findMany({
            where: {
                OR: [
                    { buyer_id: userId },
                    { seller_id: userId }
                ]
            },
            include: {
                products: {
                    include: {
                        product_images: {
                            where: { is_primary: true }
                        },
                        feedbacks: {
                            where: { from_user_id: userId }
                        }
                    }
                },
                seller: { select: { id: true, full_name: true } },
                buyer: { select: { id: true, full_name: true } }
            },
            orderBy: { created_at: 'desc' }
        });
    }
}