import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    InternalServerErrorException,
    BadRequestException,
    HttpException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { MailcowService } from '../mailcow/mailcow.service';
import {
    RegisterDto,
    LoginDto,
    SendOtpDto,
    VerifyOtpDto,
    SendEmailOtpDto,
    VerifyEmailOtpDto,
    ForgotPasswordDto,
    ForgotPasswordVerifyOtpDto,
    ResetPasswordDto,
} from './auth.dto';
import * as crypto from 'crypto';

const MAIL_DOMAIN = 'ksamail.com';
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const RESET_TOKEN_EXPIRY_MINUTES = 15; // Reset token valid for 15 min after OTP verification

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

    // ─── Helper: Mask sensitive info for user display ─────────
    private maskEmail(email: string): string {
        const [local, domain] = email.split('@');
        if (local.length <= 2) return `${local[0]}***@${domain}`;
        return `${local[0]}${local[1]}${'*'.repeat(Math.min(local.length - 2, 6))}@${domain}`;
    }

    private maskPhone(phone: string): string {
        if (phone.length <= 6) return '***' + phone.slice(-2);
        return phone.slice(0, 4) + '*'.repeat(phone.length - 6) + phone.slice(-2);
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
            try {
                this.logger.log(`📬 Creating mailbox in Mailcow: ${username}@${MAIL_DOMAIN}`);
                await this.mailcow.createMailbox(username, MAIL_DOMAIN, name, password);
                this.logger.log(`✅ Mailcow mailbox created successfully`);

                // 7. Create Mailbox record in local DB
                const mailbox = await this.prisma.mailbox.create({
                    data: {
                        email,
                        userId: user.id,
                        quota: 2048,
                        status: 'active',
                    },
                });
                this.logger.log(`✅ Mailbox record created in DB: id=${mailbox.id}`);
            } catch (mailError: any) {
                this.logger.error(`❌ Mailcow creation failed: ${mailError.message}`);
                this.logger.warn(`🔄 Rolling back user creation: ${user.id}`);
                await this.prisma.user.delete({ where: { id: user.id } });
                throw new InternalServerErrorException(`Mailcow account creation failed: ${mailError.message}`);
            }

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

    // ═══════════════════════════════════════════════════════════
    // ─── FORGOT PASSWORD FLOW ────────────────────────────────
    // ═══════════════════════════════════════════════════════════

    /**
     * Step 1: Initiate password reset
     * - User provides their KSA Mail email
     * - System looks up recovery email/phone
     * - Sends OTP to the recovery target via Authentica
     * - Creates a PasswordResetSession
     */
    async forgotPassword(data: ForgotPasswordDto) {
        const { email, method } = data;
        this.logger.log(`🔑 forgotPassword called — email: ${email}, preferredMethod: ${method || 'auto'}`);

        // 1. Find the user by their KSA Mail email
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) {
            this.logger.warn(`⚠️ Forgot password — user not found: ${email}`);
            // Don't reveal whether the account exists (security best practice)
            // Still return a success-like response to prevent enumeration
            return {
                success: true,
                message: 'If an account with this email exists, a recovery OTP has been sent.',
                method: null,
                maskedTarget: null,
            };
        }

        // 2. Determine recovery target (email or phone)
        let recoveryTarget: string | null = null;
        let recoveryMethod: 'email' | 'phone' = 'email';

        if (method === 'phone' && user.phone) {
            recoveryTarget = user.phone;
            recoveryMethod = 'phone';
        } else if (method === 'email' && user.recoveryEmail) {
            recoveryTarget = user.recoveryEmail;
            recoveryMethod = 'email';
        } else if (user.recoveryEmail) {
            // Default: prefer recovery email
            recoveryTarget = user.recoveryEmail;
            recoveryMethod = 'email';
        } else if (user.phone) {
            // Fallback: use phone
            recoveryTarget = user.phone;
            recoveryMethod = 'phone';
        }

        if (!recoveryTarget) {
            this.logger.warn(`⚠️ No recovery method available for user: ${email}`);
            throw new BadRequestException(
                'No recovery email or phone number is registered with this account. Please contact support.',
            );
        }

        this.logger.log(`📨 Recovery method: ${recoveryMethod}, target: ${recoveryTarget}`);

        // 3. Clean up old expired sessions for this user
        await this.prisma.passwordResetSession.deleteMany({
            where: { email, expiresAt: { lt: new Date() } },
        });

        // 4. Check rate limiting — max 3 active sessions
        const activeSessionCount = await this.prisma.passwordResetSession.count({
            where: { email, expiresAt: { gt: new Date() } },
        });
        if (activeSessionCount >= 3) {
            this.logger.warn(`⚠️ Too many reset requests for: ${email}`);
            throw new BadRequestException(
                'Too many password reset requests. Please wait a few minutes before trying again.',
            );
        }

        // 5. Send OTP via Authentica
        const { apiUrl, headers } = this.getAuthenticaConfig();

        try {
            const body: any = { method: recoveryMethod === 'phone' ? 'sms' : 'email' };
            if (recoveryMethod === 'phone') {
                body.phone = recoveryTarget;
            } else {
                body.email = recoveryTarget;
            }

            this.logger.log(`🌐 Sending password reset OTP: POST ${apiUrl}/send-otp`);
            this.logger.debug(`Request body: ${JSON.stringify(body)}`);

            await axios.post(`${apiUrl}/send-otp`, body, { headers });

            this.logger.log(`✅ Password reset OTP sent via ${recoveryMethod} to ${recoveryTarget}`);
        } catch (error: any) {
            this.logger.error(`❌ Failed to send password reset OTP: ${error.message}`);

            if (error.response?.status === 401) {
                throw new InternalServerErrorException('OTP service authentication failed. Please contact support.');
            }

            const errorMsg = error.response?.data?.message || error.message || 'Failed to send OTP';
            throw new InternalServerErrorException(`Failed to send recovery OTP: ${errorMsg}`);
        }

        // 6. Create PasswordResetSession
        const session = await this.prisma.passwordResetSession.create({
            data: {
                email,
                target: recoveryTarget,
                method: recoveryMethod,
                expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
            },
        });

        this.logger.log(`✅ PasswordResetSession created: id=${session.id}`);

        // 7. Return masked info to the frontend
        const maskedTarget = recoveryMethod === 'email'
            ? this.maskEmail(recoveryTarget)
            : this.maskPhone(recoveryTarget);

        return {
            success: true,
            message: `A verification code has been sent to your ${recoveryMethod === 'email' ? 'recovery email' : 'registered phone'}.`,
            method: recoveryMethod,
            maskedTarget,
        };
    }

    /**
     * Step 2: Verify OTP for password reset
     * - Verifies the OTP via Authentica
     * - Generates a short-lived reset token
     * - Returns the token to the frontend
     */
    async forgotPasswordVerifyOtp(data: ForgotPasswordVerifyOtpDto) {
        const { email, otp } = data;
        this.logger.log(`🔍 forgotPasswordVerifyOtp called — email: ${email}`);

        // 1. Find the active PasswordResetSession
        const session = await this.prisma.passwordResetSession.findFirst({
            where: {
                email,
                verified: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!session) {
            this.logger.warn(`⚠️ No active password reset session for: ${email}`);
            throw new BadRequestException('No active password reset request found. Please initiate a new one.');
        }

        if (session.attempts >= OTP_MAX_ATTEMPTS) {
            this.logger.warn(`⚠️ Too many OTP attempts for password reset: ${email}`);
            // Invalidate the session
            await this.prisma.passwordResetSession.delete({ where: { id: session.id } });
            throw new BadRequestException('Too many failed attempts. Please initiate a new password reset.');
        }

        // 2. Verify OTP via Authentica
        const { apiUrl, headers } = this.getAuthenticaConfig();

        try {
            const body: any = { otp };
            if (session.method === 'phone') {
                body.phone = session.target;
            } else {
                body.email = session.target;
            }

            this.logger.log(`🌐 Verifying password reset OTP: POST ${apiUrl}/verify-otp`);

            await axios.post(`${apiUrl}/verify-otp`, body, { headers });

            this.logger.log(`✅ Password reset OTP verified for: ${email}`);
        } catch (error: any) {
            // Increment attempt count
            await this.prisma.passwordResetSession.update({
                where: { id: session.id },
                data: { attempts: session.attempts + 1 },
            });

            this.logger.error(`❌ Password reset OTP verification failed: ${error.message}`);

            const statusCode = error.response?.status;
            if (statusCode === 422 || statusCode === 400) {
                throw new BadRequestException('Invalid OTP. Please check the code and try again.');
            }
            throw new InternalServerErrorException(`OTP verification failed: ${error.message}`);
        }

        // 3. Generate a cryptographically secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

        // 4. Update session with the reset token
        await this.prisma.passwordResetSession.update({
            where: { id: session.id },
            data: {
                verified: true,
                resetToken,
                tokenExpiresAt,
            },
        });

        this.logger.log(`✅ Reset token generated for: ${email} (expires: ${tokenExpiresAt.toISOString()})`);

        return {
            success: true,
            message: 'OTP verified successfully. You can now reset your password.',
            resetToken,
            expiresIn: RESET_TOKEN_EXPIRY_MINUTES * 60, // seconds
        };
    }

    /**
     * Step 3: Reset the password
     * - Validates the reset token
     * - Updates password in local DB (bcrypt hash)
     * - Updates password in Mailcow
     * - Cleans up the session
     */
    async resetPassword(data: ResetPasswordDto) {
        const { resetToken, newPassword } = data;
        this.logger.log(`🔐 resetPassword called with token: ${resetToken.substring(0, 8)}...`);

        // 1. Find the session by reset token
        const session = await this.prisma.passwordResetSession.findUnique({
            where: { resetToken },
        });

        if (!session) {
            this.logger.warn(`⚠️ Invalid reset token`);
            throw new BadRequestException('Invalid or expired reset token. Please initiate a new password reset.');
        }

        if (!session.verified) {
            this.logger.warn(`⚠️ Reset token exists but OTP not verified: ${session.id}`);
            throw new BadRequestException('OTP verification not completed. Please verify the OTP first.');
        }

        if (session.tokenExpiresAt && session.tokenExpiresAt < new Date()) {
            this.logger.warn(`⚠️ Reset token expired: ${session.id}`);
            // Clean up expired session
            await this.prisma.passwordResetSession.delete({ where: { id: session.id } });
            throw new BadRequestException('Reset token has expired. Please initiate a new password reset.');
        }

        // 2. Find the user
        const user = await this.prisma.user.findUnique({ where: { email: session.email } });
        if (!user) {
            this.logger.error(`❌ User not found for email: ${session.email}`);
            throw new NotFoundException('User account not found.');
        }

        // 3. Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        this.logger.debug(`New password hashed successfully`);

        // 4. Update password in local database
        await this.prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });
        this.logger.log(`✅ Password updated in local DB for: ${session.email}`);

        // 5. Update password in Mailcow
        try {
            await this.mailcow.resetPassword(session.email, newPassword);
            this.logger.log(`✅ Password updated in Mailcow for: ${session.email}`);
        } catch (mailError: any) {
            this.logger.error(`❌ Mailcow password update failed: ${mailError.message}`);
            // Password is already updated in the local DB.
            // We log this error but don't roll back — the local password is the source of truth.
            // An admin can manually sync the Mailcow password if needed.
            this.logger.warn(`⚠️ Local DB password was updated but Mailcow sync failed. Admin may need to manually sync.`);
        }

        // 6. Clean up: delete all reset sessions for this email
        await this.prisma.passwordResetSession.deleteMany({ where: { email: session.email } });
        this.logger.log(`🧹 Password reset sessions cleaned up for: ${session.email}`);

        return {
            success: true,
            message: 'Password reset successfully. You can now log in with your new password.',
        };
    }
}
