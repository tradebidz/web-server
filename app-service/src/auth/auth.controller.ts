import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AtGuard, RtGuard } from './guard';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RequestResetPasswordDto } from './dto/request-reset-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('google-login')
  @ApiOperation({ summary: 'Google OAuth login', description: 'Authenticate user with Google OAuth token' })
  @ApiBody({ schema: { type: 'object', properties: { token: { type: 'string', description: 'Google OAuth token' } } } })
  @ApiResponse({ status: 201, description: 'Successfully authenticated with Google' })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  googleLogin(@Body('token') token: string) {
    return this.authService.googleLogin(token);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new user', description: 'Create a new user account with email and password' })
  @ApiResponse({ status: 201, description: 'User successfully registered. OTP sent to email.' })
  @ApiResponse({ status: 400, description: 'Invalid input or email already exists' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'User login', description: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'Successfully logged in. Returns access and refresh tokens.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or email not verified' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(AtGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout', description: 'Logout user and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  logout(@Req() req: any) {
    const user = req.user;

    return this.authService.logout(user.id);
  }

  @UseGuards(RtGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token', description: 'Get new access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Successfully refreshed tokens' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired refresh token' })
  refresh(@Req() req: any) {
    const user = req.user;

    return this.authService.refreshTokens(user.sub, user.refreshToken);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP', description: 'Verify email with OTP code sent during registration' })
  @ApiResponse({ status: 200, description: 'Email successfully verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend OTP', description: 'Resend verification OTP to email' })
  @ApiResponse({ status: 200, description: 'OTP successfully resent' })
  @ApiResponse({ status: 400, description: 'Email not found or already verified' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOTP(dto.email);
  }

  @Post('request-reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset', description: 'Request password reset and receive OTP via email' })
  @ApiResponse({ status: 200, description: 'Password reset OTP sent to email' })
  @ApiResponse({ status: 404, description: 'Email not found' })
  requestResetPassword(@Body() dto: RequestResetPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify reset OTP', description: 'Verify OTP for password reset' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(dto.email, dto.otp);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password', description: 'Reset password using verified OTP' })
  @ApiResponse({ status: 200, description: 'Password successfully reset' })
  @ApiResponse({ status: 400, description: 'Invalid OTP or password requirements not met' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.otp, dto.new_password);
  }
}
