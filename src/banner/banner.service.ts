import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto, UpdateBannerDto } from './banner.dto';

@Injectable()
export class BannerService {
    constructor(private prisma: PrismaService) {}

    async findAll() {
        return this.prisma.banner.findMany({
            orderBy: { order: 'asc' },
        });
    }

    async findActive() {
        return this.prisma.banner.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findOne(id: string) {
        const banner = await this.prisma.banner.findUnique({
            where: { id },
        });
        if (!banner) throw new NotFoundException('Banner not found');
        return banner;
    }

    async create(data: CreateBannerDto) {
        return this.prisma.banner.create({
            data: {
                title: data.title,
                subtitle: data.subtitle,
                buttonText: data.buttonText || "Learn More",
                buttonLink: data.buttonLink || "/signup",
                image: data.image || "/hero-banner-1.png",
                bgColor: data.bgColor || "linear-gradient(135deg, rgba(10, 88, 50, 0.82) 0%, rgba(13, 110, 63, 0.75) 100%)",
                isActive: data.isActive ?? true,
                order: data.order ?? 0,
            },
        });
    }

    async update(id: string, data: UpdateBannerDto) {
        await this.findOne(id);
        return this.prisma.banner.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.banner.delete({
            where: { id },
        });
    }
}
