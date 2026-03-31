import { IsString, IsOptional, IsBoolean, IsInt, IsUrl } from 'class-validator';

export class CreateBannerDto {
    @IsString()
    title!: string;

    @IsString()
    @IsOptional()
    subtitle?: string;

    @IsString()
    @IsOptional()
    buttonText?: string;

    @IsString()
    @IsOptional()
    buttonLink?: string;

    @IsString()
    @IsOptional()
    image?: string;

    @IsString()
    @IsOptional()
    bgColor?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsInt()
    @IsOptional()
    order?: number;
}

export class UpdateBannerDto extends CreateBannerDto {}
