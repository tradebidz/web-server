import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Redis from 'ioredis';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST') || 'localhost',
      port: this.config.get('REDIS_PORT') || 6379,
    });
  }

  async register(dto: RegisterDto) {
    this.logger.log(`Registration attempt for email: ${dto.email}`);

    try {
      // 1. Validate Captcha
      // const isHuman = await this.validateCaptcha(dto.recaptcha_token);
      // if (!isHuman) {
      //   throw new ForbiddenException('Captcha validation failed. Are you a robot?');
      // }

      // 2. Check if user already exists
      this.logger.debug(`Checking if user exists: ${dto.email}`);
      const user = await this.prisma.users.findUnique({
        where: { email: dto.email },
      });

      if (user) {
        this.logger.warn(`Registration failed: User already exists - ${dto.email}`);
        throw new ForbiddenException('User already exists');
      }

      // 3. Create User
      this.logger.debug(`Creating new user: ${dto.email}`);
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const newUser = await this.prisma.users.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          full_name: dto.full_name,
          role: "BIDDER", // Explicit default,
          is_verified: false
        },
      });
      this.logger.log(`User created successfully: ${newUser.email} (ID: ${newUser.id})`);

      // 4. Send OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      this.logger.debug(`Generated OTP for ${newUser.email}: ${otp}`);

      await this.redis.set(`otp:${newUser.email}`, otp, 'EX', 60 * 5);
      this.logger.debug(`OTP stored in Redis for ${newUser.email}`);

      await this.redis.xadd('notification_stream', '*',
        'type', 'VERIFY_EMAIL',
        'email', newUser.email,
        'otp', otp,
      );
      this.logger.log(`Email notification sent to Redis stream for ${newUser.email}`);

      return {
        message: 'Registration successful. Please check your email for OTP.',
        email: newUser.email,
      };
    } catch (error) {
      this.logger.error(`Registration failed for ${dto.email}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async login(dto: LoginDto) {
    this.logger.log(`Login attempt for email: ${dto.email}`);

    try {
      const user = await this.prisma.users.findUnique({
        where: { email: dto.email },
      });

      if (!user) {
        this.logger.warn(`Login failed: User not found - ${dto.email}`);
        throw new ForbiddenException('Invalid credentials');
      }

      const pwMatches = await bcrypt.compare(dto.password, user.password);
      if (!pwMatches) {
        this.logger.warn(`Login failed: Invalid password - ${dto.email}`);
        throw new ForbiddenException('Invalid credentials');
      }

      if (!user.is_verified) {
        this.logger.warn(`Login failed: User not verified - ${dto.email}`);
        throw new ForbiddenException('User is not verified. Please check your email for OTP.');
      }

      const role = user.role || "BIDDER";
      const tokens = await this.getTokens(user.id, user.email, role);
      await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

      this.logger.log(`Login successful for user: ${dto.email}`);
      const { password, hashed_refresh_token, ...safeUser } = user;
      return {
        ...tokens,
        user: safeUser
      };
    } catch (error) {
      this.logger.error(`Login error for ${dto.email}: ${error.message}`);
      throw error;
    }
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

  async resendOTP(email: string) {
    this.logger.log(`OTP resend request for email: ${email}`);
    const COOLDOWN_SECONDS = 60;
    const cooldownKey = `otp_cooldown:${email}`;

    try {
      // Check cooldown to prevent spamming
      const cooldownRemaining = await this.redis.ttl(cooldownKey);
      if (cooldownRemaining > 0) {
        this.logger.warn(`OTP resend blocked: Cooldown active for ${email}, ${cooldownRemaining}s remaining`);
        throw new BadRequestException(`Please wait ${cooldownRemaining} seconds before requesting a new OTP`);
      }

      const user = await this.prisma.users.findUnique({
        where: { email },
      });

      if (!user) {
        this.logger.warn(`OTP resend failed: User not found - ${email}`);
        throw new BadRequestException('User not found');
      }

      if (user.is_verified) {
        this.logger.warn(`OTP resend failed: User already verified - ${email}`);
        throw new BadRequestException('User is already verified');
      }

      // Generate new OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      this.logger.debug(`Generated new OTP for ${email}: ${otp}`);

      await this.redis.set(`otp:${email}`, otp, 'EX', 60 * 5);
      this.logger.debug(`OTP stored in Redis for ${email}`);

      await this.redis.set(cooldownKey, '1', 'EX', COOLDOWN_SECONDS);
      this.logger.debug(`Cooldown set for ${email}: ${COOLDOWN_SECONDS}s`);

      await this.redis.xadd('notification_stream', '*',
        'type', 'VERIFY_EMAIL',
        'email', email,
        'otp', otp,
      );
      this.logger.log(`OTP resent successfully to ${email}`);

      return {
        message: 'OTP has been resent. Please check your email.',
        email: email,
      };
    } catch (error) {
      this.logger.error(`OTP resend error for ${email}: ${error.message}`);
      throw error;
    }
  }

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

  // --- Helper: Get Tokens ---
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

  // --- Helper: Update Refresh Token Hash ---
  async updateRefreshTokenHash(userId: number, rt: string) {
    const hash = await bcrypt.hash(rt, 10);

    await this.prisma.users.update({
      where: { id: userId },
      data: { hashed_refresh_token: hash },
    });
  }

  // --- Helper: Validate OTP ---
  async verifyOtp(email: string, inputOtp: string) {
    this.logger.log(`OTP verification attempt for email: ${email}`);

    try {
      const storedOtp = await this.redis.get(`otp:${email}`);

      if (!storedOtp) {
        this.logger.warn(`OTP verification failed: OTP expired or not found - ${email}`);
        throw new BadRequestException('OTP has expired or does not exist');
      }

      if (storedOtp !== inputOtp) {
        this.logger.warn(`OTP verification failed: Invalid OTP - ${email}`);
        throw new BadRequestException('Invalid OTP');
      }

      const user = await this.prisma.users.update({
        where: { email },
        data: { is_verified: true },
      });

      this.logger.log(`User verified successfully: ${email}`);

      // delete OTP in Redis
      await this.redis.del(`otp:${email}`);

      return this.getTokens(user.id, user.email, user.role || "BIDDER");
    } catch (error) {
      this.logger.error(`OTP verification error for ${email}: ${error.message}`);
      throw error;
    }
  }
}