import { IsString, IsOptional, IsEmail, IsIn } from 'class-validator';

export class CreateSupportTicketDto {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsString()
    category!: string;

    @IsString()
    subject!: string;

    @IsString()
    message!: string;
}

export class UpdateSupportTicketDto {
    @IsOptional()
    @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
    status?: string;
}
