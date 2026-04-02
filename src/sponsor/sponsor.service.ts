import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSponsorDto, UpdateSponsorDto } from './sponsor.dto';
import { Prisma } from '@prisma/client';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class SponsorService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private getBaseUrl() {
    const port = this.configService.get('PORT') || 4000;
    // If in production, use the real domain, otherwise localhost
    const isProd = process.env.NODE_ENV === 'production';
    return isProd ? 'https://ksamail.com' : `http://localhost:${port}`;
  }

  private mapSponsorLogo(sponsor: any) {
    const baseUrl = this.getBaseUrl();
    const updatedSponsor = { ...sponsor };

    // Handle 'logo' field
    if (updatedSponsor.logo && updatedSponsor.logo.startsWith('/uploads/')) {
        updatedSponsor.logo = `${baseUrl}${updatedSponsor.logo}`;
    }
    
    // Add 'image' field for SnappyMail UI compatibility
    updatedSponsor.image = updatedSponsor.logo;

    return updatedSponsor;
  }

  async findAll() {
    const sponsors = await this.prisma.sponsor.findMany({
      orderBy: { order: 'asc' },
    });
    return sponsors.map(s => this.mapSponsorLogo(s));
  }

  async findActive() {
    const sponsors = await this.prisma.sponsor.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
    return sponsors.map(s => this.mapSponsorLogo(s));
  }

  async create(data: CreateSponsorDto) {
    const createData: Prisma.SponsorCreateInput = {
      title: data.title,
      desc: data.desc,
      logo: data.logo,
      image: data.logo,
      features: data.features,
      link: data.link,
      isActive: data.isActive,
      order: data.order,
    };
    return this.prisma.sponsor.create({ data: createData });
  }

  async update(id: string, data: UpdateSponsorDto) {
    const sponsor = await this.prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) throw new NotFoundException('Sponsor not found');

    const updateData: Prisma.SponsorUpdateInput = {
      title: data.title,
      desc: data.desc,
      logo: data.logo,
      image: data.logo,
      features: data.features,
      link: data.link,
      isActive: data.isActive,
      order: data.order,
    };
    
    return this.prisma.sponsor.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    return this.prisma.sponsor.delete({ where: { id } });
  }
}
