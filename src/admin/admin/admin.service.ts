import { Injectable, Logger } from '@nestjs/common';
import { MailcowService } from '../../mailcow/mailcow.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(
        private mailcow: MailcowService,
        private prisma: PrismaService,
    ) { }

    async getDashboardStats() {
        // Fetch total mailboxes directly from Mailcow API
        let totalMailboxes = 0;
        let totalStorageUsedBytes = 0;
        let totalStorageLimitBytes = 0;

        try {
            const mailboxes = await this.mailcow.getAllMailboxes();
            if (Array.isArray(mailboxes)) {
                totalMailboxes = mailboxes.length;
                totalStorageUsedBytes = mailboxes.reduce((acc, mb: any) => acc + (mb.quota_used || 0), 0);
                totalStorageLimitBytes = mailboxes.reduce((acc, mb: any) => acc + (mb.quota || 0), 0);
            }
        } catch (error) {
            this.logger.error('Failed to get mailboxes for stats overview', error);
        }

        // Fetch Prisma active users
        const activeUsers = await this.prisma.user.count();

        // Fetch real traffic stats directly from Mailcow's Rspamd History
        const mailTraffic = await this.mailcow.getMailTrafficStats();
        
        // Fetch real recent activity from Mailcow API Logs
        let activityLogs = [];
        try {
            const logsResponse = await this.mailcow.getApiLogs(10); // Adding this method
            activityLogs = logsResponse.map((log: any, index: number) => {
                // Convert timestamp to human readable relative time simply, or just return formatted string
                const date = new Date(log.time * 1000);
                const timeString = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                
                return {
                    id: index,
                    type: "API",
                    user: "admin", 
                    ip: log.remote,
                    time: timeString,
                    action: `${log.method} ${log.uri}`,
                    status: "Success"
                };
            });
        } catch (error) {
            this.logger.error('Failed to get API logs', error);
        }

        return {
            totalMailboxes,
            activeUsers,
            storageUsedBytes: totalStorageUsedBytes,
            storageLimitBytes: totalStorageLimitBytes,
            mailTraffic,
            activityLogs
        };
    }

    async getSystemLogs(limit: number = 200) {
        return await this.mailcow.getSystemLogs(limit);
    }

    async getSystemHealth() {
        return this.mailcow.getSystemStatus();
    }

    async getSecurityData() {
        // Fetch fail2ban status
        const fail2ban = await this.mailcow.getFail2Ban();
        
        // Fetch DKIM for primary domain (ksamail.com) 
        // Real implementation might loop through domains or accept a domain param, but for MVP we use the main domain
        const dkim = await this.mailcow.getDkim("ksamail.com");

        return {
            fail2ban,
            dkim
        };
    }

    async unbanIp(ip: string) {
        return this.mailcow.unbanFail2Ban(ip);
    }

    async getAllAdmins() {
        const users = await this.prisma.user.findMany({
            where: {
                role: { in: ['ADMIN', 'SUPERADMIN'] }
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true,
                updatedAt: true
            }
        });

        // Add mock status and lastSeen for UI
        return users.map(user => ({
            ...user,
            status: 'Active',
            lastSeen: user.updatedAt
        }));
    }

    async inviteAdmin(data: any) {
        // Mock hashed password generation for invite 
        // Real logic should involve sending invite email and creating a bcrypt hashed temp password
        const tempPassword = "TempPassword123!"; // Replace tightly integrated auth module

        return this.prisma.user.create({
            data: {
                name: data.name,
                username: data.email.split('@')[0],
                email: data.email,
                role: data.role || 'ADMIN',
                password: tempPassword,
                emailVerified: true,
                phoneVerified: true
            }
        });
    }

    async deleteAdmin(id: string) {
        return this.prisma.user.delete({
            where: { id }
        });
    }
}
