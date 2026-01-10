import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AtGuard } from 'src/auth/guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(AtGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  @Post('categories')
  @ApiOperation({ summary: 'Create category', description: 'Create a new product category (Admin only)' })
  @ApiBody({ schema: { type: 'object', properties: { name: { type: 'string' }, parent_id: { type: 'number', nullable: true } } } })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  createCategory(@Body() dto: { name: string, parent_id?: number }) {
    return this.adminService.createCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update category', description: 'Update category name (Admin only)' })
  @ApiParam({ name: 'id', description: 'Category ID', type: 'number' })
  @ApiBody({ schema: { type: 'object', properties: { name: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  updateCategory(@Param('id') id: number, @Body() dto: { name: string }) {
    return this.adminService.updateCategory(Number(id), dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete category', description: 'Delete a product category (Admin only)' })
  @ApiParam({ name: 'id', description: 'Category ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  deleteCategory(@Param('id') id: number) {
    return this.adminService.deleteCategory(Number(id));
  }

  @Get('products')
  @ApiOperation({ summary: 'Get all products', description: 'Retrieve all products with pagination (Admin only)' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  getAllProducts(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.adminService.getAllProducts(Number(page), Number(limit));
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete product', description: 'Delete a product listing (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  deleteProduct(@Param('id') id: number) {
    return this.adminService.deleteProduct(Number(id));
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users', description: 'Retrieve all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  getAllUsers(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.adminService.getAllUsers(Number(page), Number(limit));
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user', description: 'Delete a user account (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  deleteUser(@Param('id') id: number) {
    return this.adminService.deleteUser(Number(id));
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user', description: 'Update user information (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  updateUser(@Param('id') id: number, @Body() dto: any) {
    return this.adminService.updateUser(Number(id), dto);
  }

  @Get('upgrades')
  @ApiOperation({ summary: 'Get pending upgrades', description: 'Retrieve pending seller upgrade requests (Admin only)' })
  @ApiResponse({ status: 200, description: 'Pending upgrades retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  getPendingUpgrades() {
    return this.adminService.getPendingUpgrades();
  }

  @Post('upgrades/:id/approve')
  @ApiOperation({ summary: 'Approve/reject upgrade', description: 'Approve or reject seller upgrade request (Admin only)' })
  @ApiParam({ name: 'id', description: 'Upgrade request ID', type: 'number' })
  @ApiBody({ schema: { type: 'object', properties: { approved: { type: 'boolean', description: 'Approval status' } } } })
  @ApiResponse({ status: 201, description: 'Upgrade request processed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  approveUpgrade(@Param('id') id: number, @Body('approved') approved: boolean) {
    return this.adminService.approveUpgrade(Number(id), approved);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard stats', description: 'Retrieve admin dashboard statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  getDashboard() {
    return this.adminService.getDashboardStats();
  }
}