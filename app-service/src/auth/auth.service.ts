import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) { }

  // --- Helper: Validate Captcha with Google ---
  async validateCaptcha(token: string): Promise<boolean> {
    if (!token) return false;
    
    const secretKey = this.config.get<string>('RECAPTCHA_SECRET_KEY');
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

    try {
      const response = await axios.post(verifyUrl);
      return response.data.success;
    } catch (error) {
      console.error('Captcha verification failed:', error);
      return false;
    }
  }

  async getTokens(userId: number, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [at, rt] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { access_token: at, refresh_token: rt };
  }

  async updateRefreshTokenHash(userId: number, rt: string) {
    const hash = await bcrypt.hash(rt, 10);

    await this.prisma.users.update({
      where: { id: userId },
      data: { hashed_refresh_token: hash },
    });
  }

  async register(dto: RegisterDto) {
    // 1. Validate Captcha
    const isHuman = await this.validateCaptcha(dto.recaptcha_token);
    if (!isHuman) {
      throw new ForbiddenException('Captcha validation failed. Are you a robot?');
    }

    // 2. Check if user already exists
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (user) throw new ForbiddenException('User already exists');

    // 3. Create User
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const newUser = await this.prisma.users.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        full_name: dto.full_name,
        role: "BIDDER", // Explicit default
      },
    });

    const role = newUser.role || "BIDDER";
    const tokens = await this.getTokens(newUser.id, newUser.email, role);
    await this.updateRefreshTokenHash(newUser.id, tokens.refresh_token);

    return {
      ...tokens,
      full_name: newUser.full_name,
      role: role
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new ForbiddenException('Invalid credentials');

    const pwMatches = await bcrypt.compare(dto.password, user.password);
    if (!pwMatches) throw new ForbiddenException('Invalid credentials');

    const role = user.role || "BIDDER";
    const tokens = await this.getTokens(user.id, user.email, role);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

    const { password, hashed_refresh_token, ...safeUser } = user;
    return {
      ...tokens,
      user: safeUser
    };
  }

  async logout(userId: number) {
    await this.prisma.users.updateMany({
      where: { id: userId, hashed_refresh_token: { not: null } },
      data: { hashed_refresh_token: null },
    });

    return { message: 'Logged out successfully' };
  }

  async refreshTokens(userId: number, rt: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user || !user.hashed_refresh_token)
      throw new ForbiddenException('Access Denied');

    const rtMatches = await bcrypt.compare(rt, user.hashed_refresh_token);
    if (!rtMatches) throw new ForbiddenException('Access Denied');

    const role = user.role || "BIDDER";
    const tokens = await this.getTokens(user.id, user.email, role);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

    const { password, hashed_refresh_token, ...safeUser } = user;
    return {
      ...tokens,
      user: safeUser
    };
  }
}