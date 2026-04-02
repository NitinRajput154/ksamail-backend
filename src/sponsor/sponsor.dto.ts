import { IsString, IsOptional, IsBoolean, IsInt, IsArray, IsUrl, Allow } from 'class-validator';

export class CreateSponsorDto {
    @IsString()
    title!: string;

    @IsString()
    desc!: string;

    @IsOptional()
    @IsString()
    logo?: string;

    @IsArray()
    @IsString({ each: true })
    features!: string[];

    @IsString()
    link!: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsInt()
    order?: number;
}

export class UpdateSponsorDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    desc?: string;

    @IsOptional()
    @IsString()
    logo?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    features?: string[];

    @IsOptional()
    @IsString()
    link?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsInt()
    order?: number;
}
