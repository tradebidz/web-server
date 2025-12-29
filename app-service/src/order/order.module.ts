import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrdersController } from './order.controller';

@Module({
  controllers: [OrdersController],
  providers: [OrderService],
})
export class OrderModule { }
