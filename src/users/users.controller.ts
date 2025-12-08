import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AtGuard } from 'src/auth/guard';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @UseGuards(AtGuard)
  @Get('me')
  getMe(@Req() req: any) {
    return this.usersService.getMe(req.user.id);
  }

  @UseGuards(AtGuard)
  @Patch()
  updateMe(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(req.user.id, dto);
  }
}
