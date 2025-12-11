import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

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
}
