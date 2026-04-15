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

    async suspendMailbox(email: string) {
        return this.mailcow.toggleMailboxActive(email, false);
    }

    async activateMailbox(email: string) {
        return this.mailcow.toggleMailboxActive(email, true);
    }

    async deleteMailbox(email: string) {
        // Delete from Mailcow
        await this.mailcow.deleteMailbox(email);
        
        // Cleanup Prisma records if present
        try {
            await this.prisma.mailbox.delete({
                where: { email }
            });
        } catch (e) {
            // It's fine if it doesn't exist locally
        }
        
        return { message: `Mailbox ${email} deleted successfully` };
    }

    async resetPassword(email: string, newPassword: string) {
        return this.mailcow.resetPassword(email, newPassword);
    }

    async updateQuota(email: string, quotaMB: number) {
        // Update in Mailcow
        await this.mailcow.updateMailboxQuota(email, quotaMB);
        
        // Update in Prisma if the record exists
        try {
            await this.prisma.mailbox.update({
                where: { email },
                data: { quota: quotaMB }
            });
        } catch (e) {
            // Record might not exist in Prisma, which is fine
        }
        
        return { message: `Quota updated for ${email} to ${quotaMB}MB` };
    }

    async createMailbox(data: any) {
        return this.mailcow.createMailbox(
            data.localPart,
            data.domain,
            data.fullName || data.localPart,
            data.password,
            data.quotaMB
        );
    }
}
