import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AtGuard } from 'src/auth/guard';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private prisma: PrismaService,
    private config: ConfigService
  ) { }

  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('create_payment_url')
  @ApiOperation({ summary: 'Create payment URL', description: 'Generate VNPay payment URL for an order' })
  @ApiBody({ schema: { type: 'object', properties: { orderId: { type: 'number', description: 'Order ID' } } } })
  @ApiResponse({ status: 201, description: 'Payment URL created successfully' })
  @ApiResponse({ status: 400, description: 'Order not found or already paid' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the order buyer' })
  async createPaymentUrl(@Req() req, @Body() body: { orderId: number }) {
    const userId = req.user.id;

    const order = await this.prisma.orders.findUnique({ where: { id: body.orderId } });
    if (!order) throw new BadRequestException('Order not found');

    if (order.buyer_id !== userId) throw new ForbiddenException('You are not the buyer of this order');
    if (order.payment_status === 'PAID') throw new BadRequestException('Order already paid');

    const paymentUrl = this.paymentService.createVnPayUrl(
      req,
      order.id,
      Number(order.amount),
      `Order payment for #${order.id}`
    );

    return { url: paymentUrl };
  }

  @Get('vnpay_return')
  @ApiOperation({ summary: 'VNPay return', description: 'Handle VNPay payment callback' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend with payment result' })
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

    if (Number(order.amount) * 100 !== vnpAmount) {
      await this.prisma.orders.delete({ where: { id: orderId } });
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
