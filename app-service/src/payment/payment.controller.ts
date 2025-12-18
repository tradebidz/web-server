import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AtGuard } from 'src/auth/guard';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private prisma: PrismaService,
    private config: ConfigService
  ) { }

  @UseGuards(AtGuard)
  @Post('create_payment_url')
  async createPaymentUrl(@Req() req, @Body() body: { productId: number }) {
    const userId = req.user.id;

    const product = await this.prisma.products.findUnique({ where: { id: body.productId } });

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    if (product.winner_id !== userId) {
      throw new ForbiddenException("You are not the winner of this product");
    }

    if (product.seller_id === null) {
      throw new BadRequestException('Product seller information is missing');
    }

    if (product.current_price === null) {
      throw new BadRequestException('Product price is missing');
    }

    let order = await this.prisma.orders.findUnique({ where: { product_id: product.id } });

    if (!order) {
      order = await this.prisma.orders.create({
        data: {
          product_id: product.id,
          buyer_id: userId,
          seller_id: product.seller_id,
          amount: product.current_price,
          status: 'PENDING',
          payment_status: 'UNPAID'
        }
      });
    }

    const ipAddr = req;
    const paymentUrl = this.paymentService.createVnPayUrl(
      req,
      order.id,
      Number(order.amount),
      `Order payment #${order.id}`
    );

    return { url: paymentUrl };
  }

  @Get('vnpay_return')
  async vnpayReturn(@Query() query, @Res() res: Response) {
    const isValid = this.paymentService.verifyReturnUrl(query);
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    if (!isValid) {
      return res.redirect(`${frontendUrl}/payment/failed?reason=checksum_invalid`);
    }

    const orderId = Number(query['vnp_TxnRef']);
    const vnpAmount = Number(query['vnp_Amount']);
    const rspCode = query['vnp_ResponseCode'];
    const transactionNo = query['vnp_TransactionNo'];


    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) return res.redirect('http://localhost:5173/payment/failed?reason=order_not_found');

    if (order.payment_status === 'PAID') {
      return res.redirect(`${frontendUrl}/orders/${orderId}/success`);
    }

    if (Number(order.amount) !== vnpAmount) {
      return res.redirect('http://localhost:5173/payment/failed?reason=amount_mismatch');
    }

    if (rspCode === '00') {
      // Payment success
      await this.prisma.orders.update({
        where: { id: orderId },
        data: {
          payment_status: 'PAID',
          vnp_transaction_no: transactionNo,
          vnp_txn_ref: query['vnp_TxnRef'],
          status: 'PAID'
        }
      });

      return res.redirect(`${frontendUrl}/orders/${orderId}/success`);
    } else {
      await this.prisma.orders.update({
        where: { id: orderId },
        data: { payment_status: 'FAILED' }
      });

      return res.redirect(`${frontendUrl}/payment/failed?reason=code_${rspCode}`);
    }
  }
}
