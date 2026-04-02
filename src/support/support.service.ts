import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportTicketDto, UpdateSupportTicketDto } from './support.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async create(data: CreateSupportTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        email: data.email,
        category: data.category,
        subject: data.subject,
        message: data.message,
      },
    });
  }

  async update(id: string, data: UpdateSupportTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: data.status,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.supportTicket.delete({ where: { id } });
  }
}
