import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { AtGuard } from 'src/auth/guard';
import { OrderService } from './order.service';

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
@UseGuards(AtGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrderService) { }

  @Post()
  @ApiOperation({ summary: 'Create order', description: 'Create an order for a won product' })
  @ApiBody({ schema: { type: 'object', properties: { productId: { type: 'number', description: 'Product ID' } } } })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid product or user not winner' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req, @Body('productId') productId: number) {
    return this.ordersService.createOrder(req.user.id, productId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders', description: 'Retrieve all orders for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Req() req) {
    return this.ordersService.getOrders(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order', description: 'Retrieve order details' })
  @ApiParam({ name: 'id', description: 'Order ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Req() req, @Param('id') id: string) {
    return this.ordersService.getOrder(req.user.id, Number(id));
  }
}