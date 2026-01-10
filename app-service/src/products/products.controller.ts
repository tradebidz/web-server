import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { AtGuard } from 'src/auth/guard';
import { BanBidderDto } from './dto/ban-bidder.dto';
import { AppendDescriptionDto } from './dto/append-description.dto';
import { AnswerQuestionDto } from './dto/answer-question.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Get()
  @ApiOperation({ summary: 'Get all products', description: 'Retrieve products with optional filtering and pagination' })
  @ApiResponse({ status: 200, description: 'List of products retrieved successfully' })
  findAll(@Query() query: FilterProductDto) {
    return this.productsService.findAll(query);
  }

  @Get('top-ending')
  @ApiOperation({ summary: 'Get top ending products', description: 'Retrieve products ending soon' })
  @ApiResponse({ status: 200, description: 'Top ending products retrieved' })
  getTopEnding() { return this.productsService.getTopEnding(); }

  @Get('top-bidding')
  @ApiOperation({ summary: 'Get top bidding products', description: 'Retrieve products with most active bidding' })
  @ApiResponse({ status: 200, description: 'Top bidding products retrieved' })
  getTopBidding() { return this.productsService.getTopBidding(); }

  @Get('top-price')
  @ApiOperation({ summary: 'Get highest priced products', description: 'Retrieve products with highest current bids' })
  @ApiResponse({ status: 200, description: 'Highest priced products retrieved' })
  getTopPrice() { return this.productsService.getTopPrice(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID', description: 'Retrieve detailed information about a specific product' })
  @ApiParam({ name: 'id', description: 'Product ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Product details retrieved' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':id/validate-bid')
  @ApiOperation({ summary: 'Validate bid eligibility', description: 'Check if user is eligible to bid on a product' })
  @ApiParam({ name: 'id', description: 'Product ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Eligibility status returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'User is banned from bidding on this product' })
  validateBidEligibility(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.productsService.validateBidEligibility(req.user.id, id);
  }

  @Get(':id/suggested-price')
  @ApiOperation({ summary: 'Get suggested bid price', description: 'Get the suggested next bid price for a product' })
  @ApiParam({ name: 'id', description: 'Product ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Suggested price returned' })
  getSuggestedPrice(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getSuggestedPrice(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get bid history', description: 'Retrieve bidding history for a product' })
  @ApiParam({ name: 'id', description: 'Product ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Bid history retrieved' })
  getBidHistory(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getBidHistory(id);
  }

  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':id/seller-bids')
  @ApiOperation({ summary: 'Get seller bids', description: 'Retrieve bids for seller\'s product' })
  @ApiParam({ name: 'id', description: 'Product ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Seller bids retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the product seller' })
  getSellerBids(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.productsService.getSellerBids(req.user.id, id);
  }

  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @Post(':id/questions')
  @ApiOperation({ summary: 'Ask a question', description: 'Post a question about a product' })
  @ApiParam({ name: 'id', description: 'Product ID', type: 'number' })
  @ApiBody({ schema: { type: 'object', properties: { content: { type: 'string', description: 'Question content' } } } })
  @ApiResponse({ status: 201, description: 'Question created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createQuestion(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body('content') content: string) {
    return this.productsService.createQuestion(req.user.id, id, content);
  }

  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @ApiOperation({ summary: 'Create product', description: 'Create a new product listing for auction' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid product data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req: any, @Body() dto: CreateProductDto) {
    return this.productsService.createProduct(req.user.id, dto);
  }

  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @Post(':id/descriptions')
  @ApiOperation({ summary: 'Append description', description: 'Add additional description to product' })
  @ApiParam({ name: 'id', description: 'Product ID', type: 'number' })
  @ApiResponse({ status: 201, description: 'Description appended successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the product seller' })
  appendDescription(@Req() req, @Param('id') id: number, @Body() dto: AppendDescriptionDto) {
    return this.productsService.appendDescription(req.user.id, id, dto.content);
  }

  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @Post(':id/ban-bidder')
  @ApiOperation({ summary: 'Ban bidder', description: 'Ban a bidder from bidding on this product' })
  @ApiParam({ name: 'id', description: 'Product ID', type: 'number' })
  @ApiResponse({ status: 201, description: 'Bidder banned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the product seller' })
  banBidder(@Req() req, @Param('id') id: number, @Body() dto: BanBidderDto) {
    return this.productsService.banBidder(req.user.id, id, dto);
  }

  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('questions/:questionId/answer')
  @ApiOperation({ summary: 'Answer question', description: 'Answer a question about your product' })
  @ApiParam({ name: 'questionId', description: 'Question ID', type: 'number' })
  @ApiResponse({ status: 201, description: 'Answer posted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the product seller' })
  answerQuestion(@Req() req, @Param('questionId') qId: number, @Body() dto: AnswerQuestionDto) {
    return this.productsService.answerQuestion(req.user.id, qId, dto.answer);
  }
}