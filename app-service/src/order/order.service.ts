import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { Inject } from '@nestjs/common';

@Injectable()
export class OrderService {
    constructor(
        private prisma: PrismaService,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: WinstonLogger,
    ) { }

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

        const order = await this.prisma.orders.create({
            data: {
                product_id: productId,
                buyer_id: userId,
                seller_id: product.seller_id,
                amount: product.current_price,
                status: 'PENDING',
                payment_status: 'UNPAID'
            }
        });

        this.logger.log(
            'Create Order Success',
            JSON.stringify({
                orderId: order.id,
                productId: order.product_id,
                buyerId: order.buyer_id,
                amount: order.amount
            })
        );

        return order;
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

    async uploadPaymentReceipt(userId: number, orderId: number, paymentReceiptUrl: string, shippingAddress: string) {
        const order = await this.prisma.orders.findUnique({
            where: { id: orderId }
        });

        if (!order) {
            throw new BadRequestException('Đơn hàng không tồn tại');
        }

        // Only buyer can upload payment receipt
        if (order.buyer_id !== userId) {
            throw new ForbiddenException('Chỉ người mua mới có thể đăng hóa đơn chuyển tiền');
        }

        // Check if receipt has already been uploaded
        if (order.payment_receipt_url) {
            throw new BadRequestException('Hóa đơn đã được đăng tải trước đó');
        }

        // Allow upload if payment is UNPAID (bank transfer) or PAID (VNPay success)
        if (order.payment_status !== 'UNPAID' && order.payment_status !== 'PAID') {
            throw new BadRequestException('Không thể đăng hóa đơn cho đơn hàng này');
        }

        const updatedOrder = await this.prisma.orders.update({
            where: { id: orderId },
            data: {
                payment_receipt_url: paymentReceiptUrl,
                shipping_address: shippingAddress
            },
            include: {
                products: { include: { product_images: true } },
                seller: { select: { id: true, full_name: true, email: true } },
                buyer: { select: { id: true, full_name: true, email: true } }
            }
        });

        this.logger.log(
            'Upload Payment Receipt Success',
            JSON.stringify({
                orderId: updatedOrder.id,
                buyerId: userId,
                receiptUrl: paymentReceiptUrl
            })
        );

        return updatedOrder;
    }

    async uploadShippingTracking(userId: number, orderId: number, trackingInfo: {
        trackingCode: string;
        company?: string;
        trackingUrl?: string;
    }) {
        const order = await this.prisma.orders.findUnique({
            where: { id: orderId }
        });

        if (!order) {
            throw new BadRequestException('Đơn hàng không tồn tại');
        }

        // Only seller can upload shipping tracking
        if (order.seller_id !== userId) {
            throw new ForbiddenException('Chỉ người bán mới có thể đăng vận đơn');
        }

        // Check if payment receipt has been uploaded
        if (!order.payment_receipt_url) {
            throw new BadRequestException('Người mua chưa đăng hóa đơn chuyển tiền');
        }

        const updatedOrder = await this.prisma.orders.update({
            where: { id: orderId },
            data: {
                shipping_tracking_code: trackingInfo.trackingCode,
                shipping_company: trackingInfo.company || null,
                shipping_tracking_url: trackingInfo.trackingUrl || null,
                status: 'SHIPPED' // Update status to SHIPPED when tracking is added
            },
            include: {
                products: { include: { product_images: true } },
                seller: { select: { id: true, full_name: true, email: true } },
                buyer: { select: { id: true, full_name: true, email: true } }
            }
        });

        this.logger.log(
            'Upload Shipping Tracking Success',
            JSON.stringify({
                orderId: updatedOrder.id,
                sellerId: userId,
                trackingCode: trackingInfo.trackingCode
            })
        );

        return updatedOrder;
    }

    async confirmDelivery(userId: number, orderId: number) {
        const order = await this.prisma.orders.findUnique({
            where: { id: orderId }
        });

        if (!order) {
            throw new BadRequestException('Đơn hàng không tồn tại');
        }

        // Only buyer can confirm delivery
        if (order.buyer_id !== userId) {
            throw new ForbiddenException('Chỉ người mua mới có thể xác nhận đã nhận hàng');
        }

        // Check if order has been shipped
        if (order.status !== 'SHIPPED') {
            throw new BadRequestException('Chỉ có thể xác nhận đã nhận hàng khi đơn hàng đã được vận chuyển');
        }

        const updatedOrder = await this.prisma.orders.update({
            where: { id: orderId },
            data: {
                status: 'DELIVERED' // Update status to DELIVERED when buyer confirms
            },
            include: {
                products: { include: { product_images: true } },
                seller: { select: { id: true, full_name: true, email: true } },
                buyer: { select: { id: true, full_name: true, email: true } }
            }
        });

        this.logger.log(
            'Confirm Delivery Success',
            JSON.stringify({
                orderId: updatedOrder.id,
                buyerId: userId,
                status: 'DELIVERED'
            })
        );

        return updatedOrder;
    }
}