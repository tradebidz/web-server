import { Body, Controller, Get, Param, Post, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { AtGuard } from 'src/auth/guard';
import { OrderService } from './order.service';
import { UploadPaymentReceiptDto } from './dto/upload-payment-receipt.dto';
import { UploadShippingTrackingDto } from './dto/upload-shipping-tracking.dto';

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

  @Patch(':id/payment-receipt')
  @ApiOperation({ summary: 'Upload payment receipt', description: 'Buyer uploads payment receipt image URL' })
  @ApiParam({ name: 'id', description: 'Order ID', type: 'string' })
  @ApiBody({ type: UploadPaymentReceiptDto })
  @ApiResponse({ status: 200, description: 'Payment receipt uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or order not paid' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only buyer can upload receipt' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  uploadPaymentReceipt(@Req() req, @Param('id') id: string, @Body() dto: UploadPaymentReceiptDto) {
    return this.ordersService.uploadPaymentReceipt(req.user.id, Number(id), dto.paymentReceiptUrl, dto.shippingAddress);
  }

  @Patch(':id/shipping-tracking')
  @ApiOperation({ summary: 'Upload shipping tracking', description: 'Seller uploads shipping tracking information' })
  @ApiParam({ name: 'id', description: 'Order ID', type: 'string' })
  @ApiBody({ type: UploadShippingTrackingDto })
  @ApiResponse({ status: 200, description: 'Shipping tracking uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or payment receipt not uploaded' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only seller can upload tracking' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  uploadShippingTracking(@Req() req, @Param('id') id: string, @Body() dto: UploadShippingTrackingDto) {
    return this.ordersService.uploadShippingTracking(req.user.id, Number(id), {
      trackingCode: dto.trackingCode,
      company: dto.company,
      trackingUrl: dto.trackingUrl
    });
  }

  @Patch(':id/confirm-delivery')
  @ApiOperation({ summary: 'Confirm delivery', description: 'Buyer confirms that they have received the order' })
  @ApiParam({ name: 'id', description: 'Order ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Delivery confirmed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or order not shipped' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only buyer can confirm delivery' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  confirmDelivery(@Req() req, @Param('id') id: string) {
    return this.ordersService.confirmDelivery(req.user.id, Number(id));
  }
}