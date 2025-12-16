import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AtGuard } from 'src/auth/guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(AtGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  @Post('categories')
  createCategory(@Body() dto: { name: string, parent_id?: number }) {
    return this.adminService.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: number, @Body() dto: { name: string }) {
    return this.adminService.updateCategory(Number(id), dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: number) {
    return this.adminService.deleteCategory(Number(id));
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: number) {
    return this.adminService.deleteProduct(Number(id));
  }

  @Get('users')
  getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: number) {
    return this.adminService.deleteUser(Number(id));
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: number, @Body() dto: any) {
    return this.adminService.updateUser(Number(id), dto);
  }

  @Get('upgrades')
  getPendingUpgrades() {
    return this.adminService.getPendingUpgrades();
  }

  @Post('upgrades/:id/approve')
  approveUpgrade(@Param('id') id: number, @Body('approved') approved: boolean) {
    return this.adminService.approveUpgrade(Number(id), approved);
  }

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardStats();
  }
}