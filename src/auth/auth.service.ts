import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    InternalServerErrorException,
    BadRequestException,
    HttpException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { MailcowService } from '../mailcow/mailcow.service';
import { RegisterDto, LoginDto, SendOtpDto, VerifyOtpDto, SendEmailOtpDto, VerifyEmailOtpDto } from './auth.dto';

const MAIL_DOMAIN = 'ksamail.com';
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private mailcow: MailcowService,
    ) {
        this.logger.log('AuthService initialized');
    }

    // ─── Helper: Get Authentica config ────────────────────────
    private getAuthenticaConfig() {
        const apiKey = process.env.AUTHENTICA_API_KEY;
        const apiUrl = process.env.AUTHENTICA_API_URL || 'https://api.authentica.sa/api/v2';

        this.logger.debug(`Authentica API URL: ${apiUrl}`);
        this.logger.debug(`Authentica API Key present: ${!!apiKey}`);
        this.logger.debug(`Authentica API Key (first 10 chars): ${apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET'}`);

        if (!apiKey || apiKey === 'YOUR_AUTHENTICA_API_KEY_HERE') {
            this.logger.error('❌ Authentica API key is NOT configured or still set to placeholder!');
            throw new InternalServerErrorException('Authentica API key not configured. Please set AUTHENTICA_API_KEY in .env');
        }

        return {
            apiUrl,
            headers: {
                'X-Authorization': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        };
    }

    // ─── Helper: Send OTP (generic) ──────────────────────────
    private async sendOtpGeneric(target: string, type: 'phone' | 'email') {
        this.logger.log(`📤 sendOtpGeneric called — type: ${type}, target: ${target}`);

        // Clean up expired sessions
        const deletedCount = await this.prisma.otpSession.deleteMany({
            where: { target, type, expiresAt: { lt: new Date() } },
        });
        this.logger.debug(`Cleaned up ${deletedCount.count} expired OTP sessions for ${target}`);

        // Check for existing active session (rate limiting)
        const existingSession = await this.prisma.otpSession.findFirst({
            where: { target, type, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' },
        });

        if (existingSession) {
            this.logger.debug(`Found existing session: id=${existingSession.id}, attempts=${existingSession.attempts}, verified=${existingSession.verified}`);
        }

        if (existingSession && existingSession.attempts >= OTP_MAX_ATTEMPTS) {
            this.logger.warn(`⚠️ Rate limit exceeded for ${target} (${existingSession.attempts} attempts)`);
            throw new BadRequestException('Too many OTP attempts. Please wait 5 minutes and try again.');
        }

        // Call Authentica API
        const { apiUrl, headers } = this.getAuthenticaConfig();

        try {
            const body: any = { method: type === 'phone' ? 'sms' : 'email' };
            if (type === 'phone') {
                body.phone = target;
            } else {
                body.email = target;
            }

            this.logger.log(`🌐 Calling Authentica API: POST ${apiUrl}/send-otp`);
            this.logger.debug(`Request body: ${JSON.stringify(body)}`);
            this.logger.debug(`Request headers: ${JSON.stringify({ ...headers, 'X-Authorization': headers['X-Authorization'].substring(0, 10) + '...' })}`);

            const response = await axios.post(`${apiUrl}/send-otp`, body, { headers });

            this.logger.log(`✅ Authentica API responded: status=${response.status}`);
            this.logger.debug(`Response data: ${JSON.stringify(response.data)}`);

            // Create or update session
            if (existingSession) {
                await this.prisma.otpSession.update({
                    where: { id: existingSession.id },
                    data: {
                        attempts: existingSession.attempts + 1,
                        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
                    },
                });
                this.logger.debug(`Updated existing OTP session: ${existingSession.id}`);
            } else {
                const newSession = await this.prisma.otpSession.create({
                    data: {
                        target,
                        type,
                        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
                    },
                });
                this.logger.debug(`Created new OTP session: ${newSession.id}`);
            }

            this.logger.log(`✅ OTP sent successfully via ${type === 'phone' ? 'SMS' : 'email'} to ${target}`);
            return { success: true, message: `OTP sent successfully via ${type === 'phone' ? 'SMS' : 'email'}` };
        } catch (error: any) {
            if (error instanceof HttpException) {
                this.logger.error(`❌ HttpException during OTP send: ${error.message}`);
                throw error;
            }

            this.logger.error(`❌ Authentica API call failed!`);
            this.logger.error(`   Status: ${error.response?.status || 'N/A'}`);
            this.logger.error(`   Status Text: ${error.response?.statusText || 'N/A'}`);
            this.logger.error(`   Response Data: ${JSON.stringify(error.response?.data || 'No response data')}`);
            this.logger.error(`   Error Message: ${error.message}`);

            if (error.response?.status === 401) {
                this.logger.error(`🔑 401 Unauthorized — Your AUTHENTICA_API_KEY is invalid or expired!`);
                this.logger.error(`   Please check your API key at: https://portal.authentica.sa/settings/apikeys/`);
            }

            const errorMsg = error.response?.data?.message || error.message || 'Failed to send OTP';
            throw new InternalServerErrorException(`Authentica OTP send failed: ${errorMsg}`);
        }
    }

    // ─── Helper: Verify OTP (generic) ────────────────────────
    private async verifyOtpGeneric(target: string, otp: string, type: 'phone' | 'email') {
        this.logger.log(`🔍 verifyOtpGeneric called — type: ${type}, target: ${target}, otp: ${otp.substring(0, 2)}***`);

        const session = await this.prisma.otpSession.findFirst({
            where: { target, type, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' },
        });

        if (!session) {
            this.logger.warn(`⚠️ No active OTP session found for ${target} (type: ${type})`);
            throw new BadRequestException('No active OTP session found. Please request a new OTP.');
        }

        this.logger.debug(`Found session: id=${session.id}, attempts=${session.attempts}, verified=${session.verified}, expires=${session.expiresAt}`);

        if (session.verified) {
            this.logger.log(`ℹ️ ${type} already verified for ${target}`);
            return { success: true, message: `${type === 'phone' ? 'Phone' : 'Email'} already verified`, verified: true };
        }

        if (session.attempts >= OTP_MAX_ATTEMPTS) {
            this.logger.warn(`⚠️ Max attempts reached for ${target}`);
            throw new BadRequestException('Too many verification attempts. Please request a new OTP.');
        }

        const { apiUrl, headers } = this.getAuthenticaConfig();

        try {
            const body: any = { otp };
            if (type === 'phone') {
                body.phone = target;
            } else {
                body.email = target;
            }

            this.logger.log(`🌐 Calling Authentica API: POST ${apiUrl}/verify-otp`);
            this.logger.debug(`Request body: ${JSON.stringify({ ...body, otp: body.otp.substring(0, 2) + '***' })}`);

            const response = await axios.post(`${apiUrl}/verify-otp`, body, { headers });

            this.logger.log(`✅ Authentica verify responded: status=${response.status}`);
            this.logger.debug(`Response data: ${JSON.stringify(response.data)}`);

            // Mark session as verified
            await this.prisma.otpSession.update({
                where: { id: session.id },
                data: { verified: true },
            });

            this.logger.log(`✅ ${type === 'phone' ? 'Phone' : 'Email'} verified successfully for ${target}`);
            return {
                success: true,
                message: `${type === 'phone' ? 'Phone number' : 'Email'} verified successfully`,
                verified: true,
            };
        } catch (error: any) {
            // Increment attempts on failure
            await this.prisma.otpSession.update({
                where: { id: session.id },
                data: { attempts: session.attempts + 1 },
            });

            this.logger.error(`❌ OTP verification failed for ${target}`);
            this.logger.error(`   Status: ${error.response?.status || 'N/A'}`);
            this.logger.error(`   Response: ${JSON.stringify(error.response?.data || 'No data')}`);

            const statusCode = error.response?.status;
            if (statusCode === 422 || statusCode === 400) {
                throw new BadRequestException('Invalid OTP. Please try again.');
            }
            throw new InternalServerErrorException(`OTP verification failed: ${error.message}`);
        }
    }

    // ─── Phone OTP: Send ─────────────────────────────────────
    async sendOtp(data: SendOtpDto) {
        this.logger.log(`📱 sendOtp endpoint hit — phone: ${data.phone}`);
        return this.sendOtpGeneric(data.phone, 'phone');
    }

    // ─── Phone OTP: Verify ───────────────────────────────────
    async verifyOtp(data: VerifyOtpDto) {
        this.logger.log(`📱 verifyOtp endpoint hit — phone: ${data.phone}`);
        return this.verifyOtpGeneric(data.phone, data.otp, 'phone');
    }

    // ─── Email OTP: Send ─────────────────────────────────────
    async sendEmailOtp(data: SendEmailOtpDto) {
        this.logger.log(`📧 sendEmailOtp endpoint hit — email: ${data.email}`);
        return this.sendOtpGeneric(data.email, 'email');
    }

    // ─── Email OTP: Verify ───────────────────────────────────
    async verifyEmailOtp(data: VerifyEmailOtpDto) {
        this.logger.log(`📧 verifyEmailOtp endpoint hit — email: ${data.email}`);
        return this.verifyOtpGeneric(data.email, data.otp, 'email');
    }

    // ─── Username availability ───────────────────────────────
    async checkUsername(username: string) {
        this.logger.log(`🔎 checkUsername called — username: ${username}`);
        const email = `${username}@${MAIL_DOMAIN}`;
        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        const available = !existingUser;
        this.logger.log(`   Result: ${available ? '✅ Available' : '❌ Taken'} (${email})`);
        return { available, email };
    }

    // ─── Register ────────────────────────────────────────────
    async register(data: RegisterDto) {
        const { name, username, phone, recoveryEmail, password, role } = data;
        const email = `${username}@${MAIL_DOMAIN}`;

        this.logger.log(`📝 Register called — name: ${name}, username: ${username}, email: ${email}, phone: ${phone}`);

        // 1. Check if username/email already exists
        const existingUser = await this.prisma.user.findFirst({
            where: { OR: [{ email }, { username }] },
        });
        if (existingUser) {
            this.logger.warn(`⚠️ Registration failed — username/email already taken: ${email}`);
            throw new ConflictException('Username or email already taken');
        }

        // 2. Verify that phone was verified via OTP
        const phoneSession = await this.prisma.otpSession.findFirst({
            where: { target: phone, type: 'phone', verified: true, expiresAt: { gt: new Date() } },
        });
        if (!phoneSession) {
            this.logger.warn(`⚠️ Registration failed — phone not verified: ${phone}`);
            throw new BadRequestException('Phone number not verified. Complete OTP verification first.');
        }
        this.logger.log(`✅ Phone verification confirmed for ${phone}`);

        // 3. Check if recovery email was verified (optional but tracked)
        let isEmailVerified = false;
        if (recoveryEmail) {
            const emailSession = await this.prisma.otpSession.findFirst({
                where: { target: recoveryEmail, type: 'email', verified: true, expiresAt: { gt: new Date() } },
            });
            isEmailVerified = !!emailSession;
            this.logger.log(`📧 Recovery email ${recoveryEmail} verified: ${isEmailVerified}`);
        }

        // 4. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        this.logger.debug(`Password hashed successfully`);

        // 5. Create user in database
        let user;
        try {
            user = await this.prisma.user.create({
                data: {
                    name,
                    username,
                    email,
                    phone,
                    recoveryEmail: recoveryEmail || null,
                    password: hashedPassword,
                    phoneVerified: true,
                    emailVerified: isEmailVerified,
                    role: role || 'USER',
                },
            });
            this.logger.log(`✅ User created in DB: id=${user.id}, email=${user.email}`);

            // 6. Create Mailbox in Mailcow
            // try {
            //     this.logger.log(`📬 Creating mailbox in Mailcow: ${username}@${MAIL_DOMAIN}`);
            //     await this.mailcow.createMailbox(username, MAIL_DOMAIN, name, password);
            //     this.logger.log(`✅ Mailcow mailbox created successfully`);

            //     // 7. Create Mailbox record in local DB
            //     const mailbox = await this.prisma.mailbox.create({
            //         data: {
            //             email,
            //             userId: user.id,
            //             quota: 2048,
            //             status: 'active',
            //         },
            //     });
            //     this.logger.log(`✅ Mailbox record created in DB: id=${mailbox.id}`);
            // } catch (mailError: any) {
            //     this.logger.error(`❌ Mailcow creation failed: ${mailError.message}`);
            //     this.logger.warn(`🔄 Rolling back user creation: ${user.id}`);
            //     await this.prisma.user.delete({ where: { id: user.id } });
            //     throw new InternalServerErrorException(`Mailcow account creation failed: ${mailError.message}`);
            // }

            // 8. Clean up used OTP sessions
            await this.prisma.otpSession.deleteMany({ where: { target: phone } });
            if (recoveryEmail) {
                await this.prisma.otpSession.deleteMany({ where: { target: recoveryEmail } });
            }
            this.logger.log(`🧹 OTP sessions cleaned up`);

            const { password: _, ...result } = user;
            this.logger.log(`🎉 Registration complete! User ${email} created successfully`);
            return {
                ...result,
                message: 'Account created successfully',
            };
        } catch (error) {
            this.logger.error(`❌ Registration failed: ${(error as any).message}`);
            throw error;
        }
    }

    // ─── Login ───────────────────────────────────────────────
    async login(data: LoginDto) {
        const { email, password } = data;
        this.logger.log(`🔐 Login attempt — email: ${email}`);

        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) {
            this.logger.warn(`⚠️ Login failed — user not found: ${email}`);
            throw new UnauthorizedException('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            this.logger.warn(`⚠️ Login failed — wrong password for: ${email}`);
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = { sub: user.id, email: user.email, role: user.role };
        const token = this.jwtService.sign(payload);
        this.logger.log(`✅ Login successful — user: ${email}, role: ${user.role}`);

        return {
            access_token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        };
    }
}
