import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AtGuard } from 'src/auth/guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { ToggleWatchlistDto } from './dto/toggle-watchlist.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RateSellerDto } from './dto/rate-seller.dto';
import { RequestUpgradeDto } from './dto/request-upgrade.dto';

@Controller('users')
@UseGuards(AtGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('me')
  getMe(@Req() req: any) {
    return this.usersService.getMe(req.user.id);
  }

  @Patch()
  updateMe(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(req.user.id, dto);
  }

  @Post('watchlist')
  toggleWatchlist(@Req() req, @Body() dto: ToggleWatchlistDto) {
    return this.usersService.toggleWatchlist(req.user.id, dto.productId);
  }

  @Get('watchlist')
  getMyWatchlist(@Req() req) {
    return this.usersService.getMyWatchlist(req.user.id);
  }

  @Patch('profile')
  updateProfile(@Req() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Get('feedbacks')
  getMyFeedbacks(@Req() req) {
    return this.usersService.getMyFeedbacks(req.user.id);
  }

  @Get('bids/active')
  getActiveBids(@Req() req) {
    return this.usersService.getActiveBiddingProducts(req.user.id);
  }

  @Get('bids/won')
  getWonProducts(@Req() req) {
    return this.usersService.getWonProducts(req.user.id);
  }

  @Post('rate')
  rateSeller(@Req() req, @Body() dto: RateSellerDto) {
    return this.usersService.rateSeller(req.user.id, dto);
  }

  @Post('upgrade')
  requestUpgrade(@Req() req, @Body() dto: RequestUpgradeDto) {
    return this.usersService.requestUpgrade(req.user.id, dto.reason);
  }

  @Get('selling')
  getSelling(@Req() req) {
    return this.usersService.getSellingProducts(req.user.id);
  }

  @Get('sold')
  getSold(@Req() req) {
    return this.usersService.getSoldProducts(req.user.id);
  }

  @Post('cancel-transaction')
  cancelTransaction(@Req() req, @Body('productId') productId: number) {
    return this.usersService.cancelTransaction(req.user.id, productId);
  }
}
