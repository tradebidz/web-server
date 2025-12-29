import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AtGuard } from 'src/auth/guard';
import { OrderService } from './order.service';

@Controller('orders')
@UseGuards(AtGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrderService) { }

  @Post()
  create(@Req() req, @Body('productId') productId: number) {
    return this.ordersService.createOrder(req.user.userId, productId);
  }


  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.ordersService.getOrder(req.user.userId, Number(id));
  }
}