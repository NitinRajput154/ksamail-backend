import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailcowService } from '../mailcow/mailcow.service';

@Injectable()
export class MailboxService {
    constructor(
        private prisma: PrismaService,
        private mailcow: MailcowService,
    ) { }

    async getAll() {
        return this.mailcow.getAllMailboxes();
    }

    async getByUser(userId: string) {
        return this.prisma.mailbox.findMany({
            where: { userId },
        });
    }

    async getById(id: string) {
        const mailbox = await this.prisma.mailbox.findUnique({
            where: { id },
        });
        if (!mailbox) throw new NotFoundException('Mailbox not found');
        return mailbox;
    }
}
