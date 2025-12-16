import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async getMe(userId: number) {
        const user = await this.prisma.users.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                full_name: true,
                address: true,
                role: true,
                rating_score: true,
                rating_count: true,
                is_verified: true,
                created_at: true,
            },
        });

        if (!user) throw new NotFoundException('User not found')

        return user;
    }

    async updateUser(userId: number, dto: UpdateUserDto) {
        const user = await this.prisma.users.update({
            where: { id: userId },
            data: {
                ...dto
            },
            select: {
                id: true,
                email: true,
                full_name: true,
                address: true,
                role: true,
                rating_score: true,
                rating_count: true,
                is_verified: true,
                created_at: true,
                updated_at: true,
            }
        });

        return user;
    }

    async toggleWatchlist(userId: number, productId: number) {
        const existing = await this.prisma.watchlists.findUnique({
            where: { user_id_product_id: { user_id: userId, product_id: productId } },
        });

        if (existing) {
            await this.prisma.watchlists.delete({
                where: { user_id_product_id: { user_id: userId, product_id: productId } },
            });

            return { message: 'Product removed from watchlist', action: 'remove' }
        } else {
            await this.prisma.watchlists.create({
                data: { user_id: userId, product_id: productId },
            });

            return { message: 'Product added to watchlist', action: 'add' }
        }
    }

    async getMyWatchlist(userId: number) {
        const watchlist = await this.prisma.watchlists.findMany({
            where: { user_id: userId },
            include: {
                products: {
                    include: { product_images: { where: { is_primary: true } } }
                }
            }
        });

        return watchlist;
    }

    async updateProfile(userId: number, dto: UpdateProfileDto) {
        const dataToUpdate: any = { ...dto };

        if (dto.password) {
            dataToUpdate.password = await bcrypt.hash(dto.password, 10);
        }

        return this.prisma.users.update({
            where: { id: userId },
            data: dataToUpdate
        });
    }

    async getMyFeedbacks(userId: number) {
        return this.prisma.feedbacks.findMany({
            where: { to_user_id: userId },
            include: {
                users_feedbacks_from_user_idTousers: { select: { full_name: true } },
                products: { select: { name: true } }
            }
        });
    }

    async getActiveBiddingProducts(userId: number) {
        const myBids = await this.prisma.bids.groupBy({
            by: ['product_id'],
            where: { bidder_id: userId },
        });

        const productIds = myBids.map(b => b.product_id).filter((id): id is number => id !== null);

        return this.prisma.products.findMany({
            where: {
                id: { in: productIds },
                status: 'ACTIVE'
            },
            include: {
                bids: {
                    where: { bidder_id: userId },
                    orderBy: { amount: 'desc' },
                    take: 1
                },
                product_images: { where: { is_primary: true } }
            }
        });
    }

    async getWonProducts(userId: number) {
        return this.prisma.products.findMany({
            where: {
                winner_id: userId,
                status: 'SOLD'
            },
            include: {
                product_images: { where: { is_primary: true } },
                users_products_seller_idTousers: { select: { id: true, full_name: true } }
            }
        });
    }

    async rateSeller(bidderId: number, body: { productId: number, score: number, comment: string }) {
        const product = await this.prisma.products.findUnique({ where: { id: body.productId } });
        if (product?.winner_id !== bidderId) throw new ForbiddenException("You are not the winner of this product.");
        if (!product.seller_id) throw new BadRequestException("Product does not have a seller.");

        const exist = await this.prisma.feedbacks.findFirst({
            where: { from_user_id: bidderId, product_id: body.productId }
        });
        if (exist) throw new BadRequestException("You have already rated this transaction.");

        await this.prisma.feedbacks.create({
            data: {
                from_user_id: bidderId,
                to_user_id: product.seller_id,
                product_id: body.productId,
                score: body.score,
                comment: body.comment
            }
        });

        await this.prisma.users.update({
            where: { id: product.seller_id },
            data: {
                rating_count: { increment: 1 },
                rating_score: { increment: body.score }
            }
        });

        return { message: "Rating successfully" };
    }

    async requestUpgrade(userId: number, reason: string) {
        const existing = await this.prisma.upgrade_requests.findFirst({
            where: { user_id: userId, status: 'PENDING' }
        });
        if (existing) throw new BadRequestException("Request is pending.");

        return this.prisma.upgrade_requests.create({
            data: {
                user_id: userId,
                reason: reason,
                status: 'PENDING'
            }
        });
    }

    async getSellingProducts(userId: number) {
        return this.prisma.products.findMany({
            where: { seller_id: userId, status: 'ACTIVE' },
            include: { product_images: { where: { is_primary: true } } }
        });
    }

    async getSoldProducts(userId: number) {
        return this.prisma.products.findMany({
            where: { seller_id: userId, status: 'SOLD' },
            include: {
                users_products_winner_idTousers: { select: { id: true, full_name: true } }
            }
        });
    }

    async cancelTransaction(sellerId: number, productId: number) {
        const product = await this.prisma.products.findUnique({ where: { id: productId } });

        if (!product) throw new NotFoundException("Product not found");

        if (product.seller_id !== sellerId) throw new ForbiddenException("You don't have permission");
        if (product.status !== 'SOLD' || !product.winner_id) throw new BadRequestException("Product is not sold");

        await this.prisma.products.update({
            where: { id: productId },
            data: { status: 'CANCELLED' }
        });

        await this.prisma.feedbacks.create({
            data: {
                from_user_id: sellerId,
                to_user_id: product.winner_id,
                product_id: productId,
                score: -1,
                comment: "The winner did not pay"
            }
        });

        await this.prisma.users.update({
            where: { id: product.winner_id },
            data: {
                rating_count: { increment: 1 },
                rating_score: { increment: -1 }
            }
        });

        return { message: "Đã hủy giao dịch và vote -1 người thắng." };
    }
}
