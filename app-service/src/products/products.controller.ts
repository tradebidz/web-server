import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { AtGuard } from 'src/auth/guard';
import { BanBidderDto } from './dto/ban-bidder.dto';
import { AppendDescriptionDto } from './dto/append-description.dto';
import { AnswerQuestionDto } from './dto/answer-question.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Get()
  findAll(@Query() query: FilterProductDto) {
    return this.productsService.findAll(query);
  }

  @Get('top-ending')
  getTopEnding() { return this.productsService.getTopEnding(); }

  @Get('top-bidding')
  getTopBidding() { return this.productsService.getTopBidding(); }

  @Get('top-price')
  getTopPrice() { return this.productsService.getTopPrice(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @UseGuards(AtGuard)
  @Get(':id/validate-bid')
  validateBidEligibility(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.productsService.validateBidEligibility(req.user.id, id);
  }

  @Get(':id/suggested-price')
  getSuggestedPrice(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getSuggestedPrice(id);
  }

  @Get(':id/history')
  getBidHistory(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getBidHistory(id);
  }

  @UseGuards(AtGuard)
  @Get(':id/seller-bids')
  getSellerBids(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.productsService.getSellerBids(req.user.id, id);
  }

  @UseGuards(AtGuard)
  @Post(':id/questions')
  createQuestion(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body('content') content: string) {
    return this.productsService.createQuestion(req.user.id, id, content);
  }

  @UseGuards(AtGuard)
  @Post()
  create(@Req() req: any, @Body() dto: CreateProductDto) {
    return this.productsService.createProduct(req.user.id, dto);
  }

  @UseGuards(AtGuard)
  @Post(':id/descriptions')
  appendDescription(@Req() req, @Param('id') id: number, @Body() dto: AppendDescriptionDto) {
    return this.productsService.appendDescription(req.user.id, id, dto.content);
  }

  @UseGuards(AtGuard)
  @Post(':id/ban-bidder')
  banBidder(@Req() req, @Param('id') id: number, @Body() dto: BanBidderDto) {
    return this.productsService.banBidder(req.user.id, id, dto);
  }

  @UseGuards(AtGuard)
  @Post('questions/:questionId/answer')
  answerQuestion(@Req() req, @Param('questionId') qId: number, @Body() dto: AnswerQuestionDto) {
    return this.productsService.answerQuestion(req.user.id, qId, dto.answer);
  }
}