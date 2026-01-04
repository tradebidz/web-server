import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client'; // Import Prisma namespace

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    // --- PRIVATE HELPER METHOD TO REUSE SQL LOGIC ---
    private async getProductsWithRawQuery(whereCondition: Prisma.Sql, extraJoin: Prisma.Sql = Prisma.empty) {
        const N_MINUTES = 60;
        const timeThreshold = new Date(Date.now() - N_MINUTES * 60000);

        const products = await this.prisma.$queryRaw`
            SELECT 
                p.id, p.seller_id, p.category_id, p.name, p.thumbnail, p.description,
                p.start_price, p.current_price, p.step_price, p.buy_now_price,
                p.start_time, p.end_time, p.is_auto_extend, p.status, p.winner_id,
                p.view_count, p.created_at, p.updated_at,
                c.name as category_name,
                seller.full_name as seller_name,
                seller.rating_score as seller_rating_score,
                seller.rating_count as seller_rating_count,
                winner.full_name as winner_name,
                (SELECT u.full_name FROM bids b JOIN users u ON b.bidder_id = u.id WHERE b.product_id = p.id AND b.status = 'VALID' ORDER BY b.amount DESC LIMIT 1) as current_bidder_name,
                (SELECT COUNT(*)::int FROM bids b WHERE b.product_id = p.id) as bid_count,
                (CASE WHEN p.created_at > ${timeThreshold} THEN true ELSE false END) as is_new
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN users seller ON p.seller_id = seller.id
            LEFT JOIN users winner ON p.winner_id = winner.id
            ${extraJoin}
            ${whereCondition}
            ORDER BY p.created_at DESC
        `;

        // Mapping logic identical to ProductsService
        const enrichedProducts = await Promise.all(
            (products as any[]).map(async (p) => {
                const img = await this.prisma.product_images.findFirst({
                    where: { product_id: p.id, is_primary: true },
                });

                return {
                    id: p.id,
                    seller_id: p.seller_id,
                    category_id: p.category_id,
                    name: p.name,
                    thumbnail: img?.url || p.thumbnail, // Fallback logic
                    description: p.description,
                    start_price: p.start_price,
                    current_price: p.current_price,
                    step_price: p.step_price,
                    buy_now_price: p.buy_now_price,
                    start_time: p.start_time,
                    end_time: p.end_time,
                    is_auto_extend: p.is_auto_extend,
                    status: p.status,
                    winner_id: p.winner_id,
                    view_count: p.view_count,
                    bid_count: p.bid_count,
                    is_new: p.is_new,
                    created_at: p.created_at,
                    updated_at: p.updated_at,
                    category: p.category_name ? {
                        id: p.category_id,
                        name: p.category_name
                    } : null,
                    seller: p.seller_name ? {
                        id: p.seller_id,
                        full_name: p.seller_name,
                        rating_score: p.seller_rating_score,
                        rating_count: p.seller_rating_count
                    } : null,
                    winner: p.winner_name ? {
                        id: p.winner_id,
                        full_name: p.winner_name
                    } : null,
                    current_bidder_name: p.current_bidder_name,
                }
            })
        );

        return enrichedProducts;
    }

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

        if (!user) throw new NotFoundException('User not found');

        const pendingRequest = await this.prisma.upgrade_requests.findFirst({
            where: { user_id: userId, status: 'PENDING' }
        });

        return { ...user, has_pending_upgrade_request: !!pendingRequest };
    }

    async updateUser(userId: number, dto: UpdateUserDto) {
        return this.prisma.users.update({
            where: { id: userId },
            data: { ...dto },
            select: {
                id: true, email: true, full_name: true, address: true, role: true,
                rating_score: true, rating_count: true, is_verified: true,
                created_at: true, updated_at: true,
            }
        });
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

    // 1. UPDATED: Get My Watchlist
    async getMyWatchlist(userId: number) {
        // Join with watchlists table to filter by user_id
        const join = Prisma.sql`JOIN watchlists w ON p.id = w.product_id`;
        const where = Prisma.sql`WHERE w.user_id = ${userId}`;

        return this.getProductsWithRawQuery(where, join);
    }

    async updateProfile(userId: number, dto: UpdateProfileDto) {
        const { old_password, password, ...otherFields } = dto;
        const dataToUpdate: any = { ...otherFields };

        if (password) {
            if (!old_password) throw new BadRequestException('Old password is required to change password');
            const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { password: true } });
            if (!user) throw new NotFoundException('User not found');
            const isOldPasswordValid = await bcrypt.compare(old_password, user.password);
            if (!isOldPasswordValid) throw new BadRequestException('Old password is incorrect');
            dataToUpdate.password = await bcrypt.hash(password, 10);
        }

        return this.prisma.users.update({
            where: { id: userId },
            data: dataToUpdate,
            select: {
                id: true, email: true, full_name: true, dob: true, address: true, role: true,
                rating_score: true, rating_count: true, is_verified: true,
                created_at: true, updated_at: true,
            }
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

    // 2. UPDATED: Get Active Bidding Products
    async getActiveBiddingProducts(userId: number) {
        // Use EXISTS to find products where the user has placed a bid
        const where = Prisma.sql`
            WHERE p.status = 'ACTIVE' 
            AND EXISTS (SELECT 1 FROM bids b WHERE b.product_id = p.id AND b.bidder_id = ${userId})
        `;
        return this.getProductsWithRawQuery(where);
    }

    // 3. UPDATED: Get Won Products
    async getWonProducts(userId: number) {
        const products = await this.prisma.products.findMany({
            where: {
                winner_id: userId,
                status: 'SOLD'
            },
            include: {
                product_images: {
                    where: { is_primary: true }
                },
                users_products_seller_idTousers: {
                    select: { id: true, full_name: true }
                },
                orders: true,
                feedbacks: {
                    where: { from_user_id: userId }
                }
            },
            orderBy: { updated_at: 'desc' }
        });

        // Map to maintain frontend compatibility
        return products.map(p => ({
            ...p,
            seller: p.users_products_seller_idTousers,
            orders: p.orders ? [p.orders] : [] // Convert singular order to array for frontend
        }));
    }

    async rateTransaction(userId: number, body: { productId: number, score: number, comment: string }) {
        const product = await this.prisma.products.findUnique({ where: { id: body.productId } });
        if (!product) throw new NotFoundException("Product not found");

        let targetUserId: number;

        if (product.winner_id === userId) {
            // User is winner, rating seller
            if (!product.seller_id) throw new BadRequestException("Product does not have a seller.");
            targetUserId = product.seller_id;
        } else if (product.seller_id === userId) {
            // User is seller, rating winner
            if (!product.winner_id) throw new BadRequestException("Product does not have a winner.");
            targetUserId = product.winner_id;
        } else {
            throw new ForbiddenException("You are not part of this transaction.");
        }

        const exist = await this.prisma.feedbacks.findFirst({
            where: { from_user_id: userId, product_id: body.productId }
        });
        if (exist) throw new BadRequestException("You have already rated this transaction.");

        await this.prisma.feedbacks.create({
            data: {
                from_user_id: userId,
                to_user_id: targetUserId,
                product_id: body.productId,
                score: body.score,
                comment: body.comment
            }
        });

        await this.prisma.users.update({
            where: { id: targetUserId },
            data: { rating_count: { increment: 1 }, rating_score: { increment: body.score } }
        });

        return { message: "Rating successfully" };
    }

    async requestUpgrade(userId: number, reason: string) {
        const existing = await this.prisma.upgrade_requests.findFirst({
            where: { user_id: userId, status: 'PENDING' }
        });
        if (existing) throw new BadRequestException("Request is pending.");

        return this.prisma.upgrade_requests.create({
            data: { user_id: userId, reason: reason, status: 'PENDING' }
        });
    }

    // 4. UPDATED: Get Selling Products
    async getSellingProducts(userId: number) {
        const products = await this.prisma.products.findMany({
            where: { seller_id: userId, status: 'ACTIVE' },
            include: {
                product_images: { where: { is_primary: true } },
                _count: { select: { bids: true } },
                bids: {
                    orderBy: { amount: 'desc' },
                    take: 1,
                    include: { users: { select: { full_name: true } } }
                }
            }
        });

        return products.map(p => ({
            ...p,
            bid_count: p._count.bids,
            current_bidder_name: p.bids[0]?.users?.full_name || null
        }));
    }

    async getSoldProducts(userId: number) {
        const products = await this.prisma.products.findMany({
            where: { seller_id: userId, status: { in: ['SOLD', 'CANCELLED'] } },
            include: {
                product_images: { where: { is_primary: true } },
                users_products_winner_idTousers: { select: { id: true, full_name: true } },
                feedbacks: {
                    where: { from_user_id: userId }
                }
            },
            orderBy: { updated_at: 'desc' }
        });

        return products.map(p => ({
            ...p,
            winner: p.users_products_winner_idTousers,
            is_rated: p.feedbacks.length > 0
        }));
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
            data: { rating_count: { increment: 1 }, rating_score: { increment: -1 } }
        });

        return { message: "Cancelled transaction and voted -1 for winner." };
    }
}