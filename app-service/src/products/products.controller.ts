import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { AtGuard } from 'src/auth/guard';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Get()
  findAll(@Query() query: FilterProductDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @UseGuards(AtGuard)
  @Post()
  create(@Req() req: any, @Body() dto: CreateProductDto) {
    return this.productsService.createProduct(req.user.id, dto);
  }

  @Get('top-ending')
  getTopEnding() { return this.productsService.getTopEnding(); }

  @Get('top-bidding')
  getTopBidding() { return this.productsService.getTopBidding(); }

  @Get('top-price')
  getTopPrice() { return this.productsService.getTopPrice(); }
}