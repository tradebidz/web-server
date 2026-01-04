import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdminService {
    constructor(private prisma: PrismaService) { }

    async createCategory(dto: { name: string, parent_id?: number }) {
        return this.prisma.categories.create({ data: dto });
    }

    async updateCategory(id: number, dto: { name: string }) {
        return this.prisma.categories.update({ where: { id }, data: dto });
    }

    async deleteCategory(id: number) {
        const productCount = await this.prisma.products.count({ where: { category_id: id } });
        if (productCount > 0) {
            throw new BadRequestException('Không thể xóa danh mục đã có sản phẩm');
        }

        const childCount = await this.prisma.categories.count({ where: { parent_id: id } });
        if (childCount > 0) {
            throw new BadRequestException('Không thể xóa danh mục đang chứa danh mục con');
        }

        return this.prisma.categories.delete({ where: { id } });
    }

    async getAllProducts(page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
            this.prisma.products.findMany({
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
                include: {
                    categories: true,
                    users_products_seller_idTousers: {
                        select: { id: true, full_name: true, email: true }
                    }
                }
            }),
            this.prisma.products.count(),
        ]);

        return {
            data: products,
            total,
            page,
            limit,
            last_page: Math.ceil(total / limit),
        };
    }

    async deleteProduct(id: number) {
        return this.prisma.products.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });
    }

    async getAllUsers(page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            this.prisma.users.findMany({
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.users.count(),
        ]);

        return {
            data: users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async deleteUser(id: number) {
        return this.prisma.users.delete({ where: { id } });
    }

    async updateUser(id: number, dto: any) {
        if (dto.password) {
            dto.password = await bcrypt.hash(dto.password, 10);
        }
        return this.prisma.users.update({ where: { id }, data: dto });
    }

    async getPendingUpgrades() {
        return this.prisma.upgrade_requests.findMany({
            where: { status: 'PENDING' },
            include: { users: true }
        });
    }

    async approveUpgrade(requestId: number, isApproved: boolean) {
        const request = await this.prisma.upgrade_requests.findUnique({ where: { id: requestId } });

        if (!request) throw new NotFoundException("Request not found");
        if (!request.user_id) throw new NotFoundException("User not found");

        if (isApproved) {
            return this.prisma.$transaction([
                this.prisma.users.update({
                    where: { id: request.user_id },
                    data: { role: 'SELLER' }
                }),
                this.prisma.upgrade_requests.update({
                    where: { id: requestId },
                    data: { status: 'APPROVED' }
                })
            ]);
        } else {
            return this.prisma.upgrade_requests.update({
                where: { id: requestId },
                data: { status: 'REJECTED' }
            });
        }
    }

    async getDashboardStats() {
        const now = new Date();
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            newUsersLast7Days,
            totalAuctions,
            newAuctionsLast7Days,
            totalRevenue,
            pendingUpgrades
        ] = await Promise.all([
            this.prisma.users.count(),
            this.prisma.users.count({ where: { created_at: { gte: last7Days } } }),
            this.prisma.products.count(),
            this.prisma.products.count({ where: { created_at: { gte: last7Days } } }),
            this.prisma.products.aggregate({
                _sum: { current_price: true },
                where: { status: 'SOLD' }
            }),
            this.prisma.upgrade_requests.count({ where: { status: 'PENDING' } })
        ]);

        const revenueByCategory = await this.prisma.$queryRaw`
        SELECT c.name, SUM(p.current_price) as value
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'SOLD'
        GROUP BY c.name
    `;

        return {
            users: { total: totalUsers, new_last_7_days: newUsersLast7Days },
            auctions: { total: totalAuctions, new_last_7_days: newAuctionsLast7Days },
            revenue: { total_gmv: totalRevenue._sum.current_price || 0 }, // Gross Merchandise Value
            pending_upgrades: pendingUpgrades,
            chart_data: revenueByCategory
        };
    }
}