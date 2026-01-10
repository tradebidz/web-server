import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AtGuard } from 'src/auth/guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { ToggleWatchlistDto } from './dto/toggle-watchlist.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RateSellerDto } from './dto/rate-seller.dto';
import { RequestUpgradeDto } from './dto/request-upgrade.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(AtGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('me')
  @ApiOperation({ summary: 'Get current user', description: 'Get authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@Req() req: any) {
    return this.usersService.getMe(req.user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update user', description: 'Update user information' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateMe(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(req.user.id, dto);
  }

  @Post('watchlist')
  @ApiOperation({ summary: 'Toggle watchlist', description: 'Add or remove product from watchlist' })
  @ApiResponse({ status: 201, description: 'Watchlist updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  toggleWatchlist(@Req() req, @Body() dto: ToggleWatchlistDto) {
    return this.usersService.toggleWatchlist(req.user.id, dto.productId);
  }

  @Get('watchlist')
  @ApiOperation({ summary: 'Get watchlist', description: 'Retrieve user watchlist' })
  @ApiResponse({ status: 200, description: 'Watchlist retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyWatchlist(@Req() req) {
    return this.usersService.getMyWatchlist(req.user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update profile', description: 'Update user profile information' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateProfile(@Req() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Get('feedbacks')
  @ApiOperation({ summary: 'Get feedbacks', description: 'Retrieve user feedbacks and ratings' })
  @ApiResponse({ status: 200, description: 'Feedbacks retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyFeedbacks(@Req() req) {
    return this.usersService.getMyFeedbacks(req.user.id);
  }

  @Get('bids/active')
  @ApiOperation({ summary: 'Get active bids', description: 'Retrieve products user is actively bidding on' })
  @ApiResponse({ status: 200, description: 'Active bids retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getActiveBids(@Req() req) {
    return this.usersService.getActiveBiddingProducts(req.user.id);
  }

  @Get('bids/won')
  @ApiOperation({ summary: 'Get won products', description: 'Retrieve products user has won' })
  @ApiResponse({ status: 200, description: 'Won products retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getWonProducts(@Req() req) {
    return this.usersService.getWonProducts(req.user.id);
  }

  @Post('rate')
  @ApiOperation({ summary: 'Rate seller', description: 'Rate and provide feedback for a seller' })
  @ApiResponse({ status: 201, description: 'Rating submitted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  rateTransaction(@Req() req, @Body() dto: RateSellerDto) {
    return this.usersService.rateTransaction(req.user.id, dto);
  }

  @Post('upgrade')
  @ApiOperation({ summary: 'Request upgrade', description: 'Request account upgrade to seller' })
  @ApiResponse({ status: 201, description: 'Upgrade request submitted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  requestUpgrade(@Req() req, @Body() dto: RequestUpgradeDto) {
    return this.usersService.requestUpgrade(req.user.id, dto.reason);
  }

  @Get('selling')
  @ApiOperation({ summary: 'Get selling products', description: 'Retrieve products user is currently selling' })
  @ApiResponse({ status: 200, description: 'Selling products retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSelling(@Req() req) {
    return this.usersService.getSellingProducts(req.user.id);
  }

  @Get('sold')
  @ApiOperation({ summary: 'Get sold products', description: 'Retrieve products user has sold' })
  @ApiResponse({ status: 200, description: 'Sold products retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSold(@Req() req) {
    return this.usersService.getSoldProducts(req.user.id);
  }

  @Post('cancel-transaction')
  @ApiOperation({ summary: 'Cancel transaction', description: 'Cancel a transaction for a product' })
  @ApiBody({ schema: { type: 'object', properties: { productId: { type: 'number' } } } })
  @ApiResponse({ status: 201, description: 'Transaction cancelled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  cancelTransaction(@Req() req, @Body('productId') productId: number) {
    return this.usersService.cancelTransaction(req.user.id, productId);
  }
}
