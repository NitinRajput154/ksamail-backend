import { Controller, Post, Body, HttpCode, HttpStatus, Res, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
    RegisterDto,
    LoginDto,
    SendOtpDto,
    VerifyOtpDto,
    SendEmailOtpDto,
    VerifyEmailOtpDto,
    CheckUsernameDto,
} from './auth.dto';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(private authService: AuthService) {
        this.logger.log('AuthController initialized');
    }

    // ─── Phone OTP ───────────────────────────────────────────
    @Post('send-otp')
    @HttpCode(HttpStatus.OK)
    async sendOtp(@Body() data: SendOtpDto) {
        this.logger.log(`POST /auth/send-otp — phone: ${data.phone}`);
        return this.authService.sendOtp(data);
    }

    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    async verifyOtp(@Body() data: VerifyOtpDto) {
        this.logger.log(`POST /auth/verify-otp — phone: ${data.phone}`);
        return this.authService.verifyOtp(data);
    }

    // ─── Email OTP ───────────────────────────────────────────
    @Post('send-email-otp')
    @HttpCode(HttpStatus.OK)
    async sendEmailOtp(@Body() data: SendEmailOtpDto) {
        this.logger.log(`POST /auth/send-email-otp — email: ${data.email}`);
        return this.authService.sendEmailOtp(data);
    }

    @Post('verify-email-otp')
    @HttpCode(HttpStatus.OK)
    async verifyEmailOtp(@Body() data: VerifyEmailOtpDto) {
        this.logger.log(`POST /auth/verify-email-otp — email: ${data.email}`);
        return this.authService.verifyEmailOtp(data);
    }

    // ─── Username Check ──────────────────────────────────────
    @Post('check-username')
    @HttpCode(HttpStatus.OK)
    async checkUsername(@Body() data: CheckUsernameDto) {
        this.logger.log(`POST /auth/check-username — username: ${data.username}`);
        return this.authService.checkUsername(data.username);
    }

    // ─── Register ────────────────────────────────────────────
    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() data: RegisterDto) {
        this.logger.log(`POST /auth/register — name: ${data.name}, username: ${data.username}`);
        return this.authService.register(data);
    }

    // ─── Login ───────────────────────────────────────────────
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() data: LoginDto, @Res({ passthrough: true }) response: Response) {
        this.logger.log(`POST /auth/login — email: ${data.email}`);
        const result = await this.authService.login(data);

        response.cookie('access_token', result.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000,
        });

        this.logger.log(`✅ Login cookie set for ${data.email}`);
        return result;
    }

    // ─── Logout ──────────────────────────────────────────────
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(@Res({ passthrough: true }) response: Response) {
        this.logger.log(`POST /auth/logout — Logging out user`);
        
        response.clearCookie('access_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });

        return { success: true, message: 'Logged out successfully' };
    }
}
