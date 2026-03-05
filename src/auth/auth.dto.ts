import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum, Matches } from 'class-validator';

export enum Role {
    ADMIN = 'ADMIN',
    USER = 'USER',
}

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'Username can only contain letters, numbers, dots, hyphens, and underscores' })
    username!: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^\+\d{7,15}$/, { message: 'Phone must be a valid international number starting with + (e.g. +9665XXXXXXXX or +91XXXXXXXXXX)' })
    phone!: string;

    @IsOptional()
    @IsEmail()
    recoveryEmail?: string;

    @IsString()
    @MinLength(8)
    password!: string;

    @IsOptional()
    @IsEnum(Role)
    role?: Role;
}

export class LoginDto {
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    password!: string;
}

export class SendOtpDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+\d{7,15}$/, { message: 'Phone must be a valid international number starting with + (e.g. +9665XXXXXXXX or +91XXXXXXXXXX)' })
    phone!: string;
}

export class VerifyOtpDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+\d{7,15}$/, { message: 'Phone must be a valid international number starting with + (e.g. +9665XXXXXXXX or +91XXXXXXXXXX)' })
    phone!: string;

    @IsString()
    @IsNotEmpty()
    otp!: string;
}

export class CheckUsernameDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'Username can only contain letters, numbers, dots, hyphens, and underscores' })
    username!: string;
}

export class SendEmailOtpDto {
    @IsEmail()
    @IsNotEmpty()
    email!: string;
}

export class VerifyEmailOtpDto {
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @IsString()
    @IsNotEmpty()
    otp!: string;
}

