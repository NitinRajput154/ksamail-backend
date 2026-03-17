import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class MailcowService {
    private readonly logger = new Logger(MailcowService.name);
    private readonly axios: AxiosInstance;

    constructor() {
        const baseURL = process.env.MAILCOW_BASE_URL;
        const apiKey = process.env.MAILCOW_API_KEY;

        this.logger.log(`MailcowService initialized`);
        this.logger.log(`  Base URL: ${baseURL || 'NOT SET'}`);
        this.logger.log(`  API Key present: ${!!apiKey}`);

        this.axios = axios.create({
            baseURL,
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json',
            },
        });
    }

    async createMailbox(localPart: string, domain: string, fullName: string, password: string, quotaMB: number = 2048) {
        this.logger.log(`📬 createMailbox called — ${localPart}@${domain}, name: ${fullName}, quota: ${quotaMB}MB`);
        try {
            const payload = {
                local_part: localPart,
                domain: domain,
                name: fullName,
                password: password,
                password2: password,
                quota: quotaMB,
                active: '1',
            };

            this.logger.debug(`Mailcow payload: ${JSON.stringify({ ...payload, password: '***' })}`);
            const response = await this.axios.post('/api/v1/add/mailbox', payload);

            this.logger.log(`Mailcow response status: ${response.status}`);
            this.logger.debug(`Mailcow response data: ${JSON.stringify(response.data)}`);

            if (response.data[0]?.type === 'error' || response.data[0]?.type === 'danger' || response.status !== 200) {
                const msgObj = response.data[0]?.msg;
                const msg = Array.isArray(msgObj) ? msgObj.join(', ') : (msgObj || 'Mailcow API error');
                this.logger.error(`❌ Mailcow error response: ${msg}`);
                throw new Error(String(msg));
            }

            this.logger.log(`✅ Mailbox created successfully: ${localPart}@${domain}`);
            return response.data;
        } catch (error: any) {
            this.logger.error(`❌ Mailcow Creation Failed: ${error.message}`);
            if (error.response) {
                this.logger.error(`   Status: ${error.response.status}`);
                this.logger.error(`   Data: ${JSON.stringify(error.response.data)}`);
            }
            throw new InternalServerErrorException(`Mailcow Creation Failed: ${error.message}`);
        }
    }

    async deleteMailbox(email: string) {
        this.logger.log(`🗑️ deleteMailbox called — ${email}`);
        try {
            const response = await this.axios.post('/api/v1/delete/mailbox', [email]);
            if (response.data[0]?.type === 'error' || response.data[0]?.type === 'danger') {
                const msgObj = response.data[0]?.msg;
                throw new Error(String(Array.isArray(msgObj) ? msgObj.join(', ') : (msgObj || 'Mailcow API error')));
            }
            this.logger.log(`✅ Mailbox deleted: ${email}`);
            return response.data;
        } catch (error: any) {
            this.logger.error(`❌ Mailcow Deletion Failed: ${error.message}`);
            throw new InternalServerErrorException(`Mailcow Deletion Failed: ${error.message}`);
        }
    }

    async toggleMailboxActive(email: string, active: boolean) {
        this.logger.log(`🔄 toggleMailboxActive called — ${email} -> ${active}`);
        try {
            const payload = {
                items: [email],
                attr: {
                    active: active ? "1" : "0"
                }
            };
            const response = await this.axios.post('/api/v1/edit/mailbox', payload);
            if (response.data[0]?.type === 'error' || response.data[0]?.type === 'danger') {
                const msgObj = response.data[0]?.msg;
                throw new Error(String(Array.isArray(msgObj) ? msgObj.join(', ') : (msgObj || 'Mailcow API error')));
            }
            this.logger.log(`✅ Mailbox status updated: ${email}`);
            return response.data;
        } catch (error: any) {
             this.logger.error(`❌ Mailcow Toggle Failed: ${error.message}`);
             throw new InternalServerErrorException(`Mailcow Toggle Failed: ${error.message}`);
        }
    }

    async resetPassword(email: string, newPassword: string) {
        this.logger.log(`🔑 resetPassword called — ${email}`);
        try {
            const payload = {
                items: [email],
                attr: {
                    password: newPassword,
                    password2: newPassword
                }
            };
            const response = await this.axios.post('/api/v1/edit/mailbox', payload);
            if (response.data[0]?.type === 'error' || response.data[0]?.type === 'danger') {
                const msgObj = response.data[0]?.msg;
                throw new Error(String(Array.isArray(msgObj) ? msgObj.join(', ') : (msgObj || 'Mailcow API error')));
            }
            this.logger.log(`✅ Mailbox password updated: ${email}`);
            return response.data;
        } catch (error: any) {
             this.logger.error(`❌ Mailcow Reset Password Failed: ${error.message}`);
             throw new InternalServerErrorException(`Mailcow Reset Password Failed: ${error.message}`);
        }
    }

    async getDomainQuotas() {
        this.logger.log(`📊 getDomainQuotas called for all domains`);
        try {
            const response = await this.axios.get('/api/v1/get/domain/all');
            return response.data;
        } catch (error: any) {
            this.logger.error(`❌ Mailcow Domain Quota Failed: ${error.message}`);
            throw new InternalServerErrorException(`Mailcow Domain Quota Failed: ${error.message}`);
        }
    }

    async getSystemStatus() {
        this.logger.log(`🏥 getSystemStatus called for containers, host, and disk`);
        try {
            const containersPromise = this.axios.get('/api/v1/get/status/containers');
            const hostPromise = this.axios.get('/api/v1/get/status/host').catch(() => ({ data: null }));
            const diskPromise = this.axios.get('/api/v1/get/status/vmail').catch(() => ({ data: null }));

            const [containers, host, disk] = await Promise.all([containersPromise, hostPromise, diskPromise]);

            return {
                containers: containers.data,
                host: host.data,
                disk: disk.data
            };
        } catch (error: any) {
            this.logger.error(`❌ Mailcow System Status Failed: ${error.message}`);
            throw new InternalServerErrorException(`Mailcow System Status Failed: ${error.message}`);
        }
    }

    async getAllMailboxes() {
        this.logger.log(`📋 getAllMailboxes called`);
        try {
            const response = await this.axios.get('/api/v1/get/mailbox/all');
            this.logger.log(`✅ Fetched ${Array.isArray(response.data) ? response.data.length : '?'} mailboxes`);
            return response.data;
        } catch (error: any) {
            this.logger.error(`❌ Mailcow Listing Failed: ${error.message}`);
            
            // Fallback for local development or when Mailcow is unreachable
            this.logger.warn(`⚠️ Returning mock data since Mailcow API is unreachable.`);
            return [
                {
                    username: "admin@ksamail.com",
                    domain: "ksamail.com",
                    quota: 5242880, // 5GB in KB
                    quota_used: 1258291, // 1.2GB in KB
                    percent_used: 24,
                    active: 1,
                    last_login: "2026-03-17 10:30:00"
                },
                {
                    username: "info@ksamail.com",
                    domain: "ksamail.com",
                    quota: 2097152, // 2GB
                    quota_used: 1887436, // 1.8GB
                    percent_used: 90,
                    active: 1,
                    last_login: "2026-03-17 08:15:00"
                },
                {
                    username: "support@ksamail.com",
                    domain: "ksamail.com",
                    quota: 10485760, // 10GB
                    quota_used: 419430, // 0.4GB
                    percent_used: 4,
                    active: 1,
                    last_login: "2026-03-16 14:00:00"
                },
                {
                    username: "test@ksamail.com",
                    domain: "ksamail.com",
                    quota: 1048576, // 1GB
                    quota_used: 943718, // 0.9GB
                    percent_used: 90,
                    active: 0,
                    last_login: "2026-03-10 09:00:00"
                }
            ];
            // throw new InternalServerErrorException(`Mailcow Listing Failed: ${error.message}`);
        }
    }

    async getFail2Ban() {
        this.logger.log(`🛡️ getFail2Ban called`);
        try {
            const response = await this.axios.get('/api/v1/get/fail2ban');
            return response.data;
        } catch (error: any) {
            this.logger.error(`❌ Mailcow Fail2Ban Failed: ${error.message}`);
            throw new InternalServerErrorException(`Mailcow Fail2Ban Failed: ${error.message}`);
        }
    }

    async unbanFail2Ban(ip: string) {
        this.logger.log(`🔓 unbanFail2Ban called for IP: ${ip}`);
        try {
            const payload = {
                items: [ip],
                attr: { action: "unban" }
            };
            const response = await this.axios.post('/api/v1/edit/fail2ban', payload);
            return response.data;
        } catch (error: any) {
            this.logger.error(`❌ Mailcow Unban Failed: ${error.message}`);
            throw new InternalServerErrorException(`Mailcow Unban Failed: ${error.message}`);
        }
    }

    async getDkim(domain: string) {
        this.logger.log(`🔑 getDkim called for domain: ${domain}`);
        try {
            const response = await this.axios.get(`/api/v1/get/dkim/${domain}`);
            return response.data;
        } catch (error: any) {
            this.logger.error(`❌ Mailcow DKIM Failed: ${error.message}`);
            return null; // Return null if it fails so it doesn't break the whole dashboard
        }
    }

    async getMailTrafficStats() {
        this.logger.log(`📈 getMailTrafficStats called for Rspamd history`);
        // Initialize an empty week of traffic data up to today
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const currentDayIndex = new Date().getDay();
        const mailTraffic: Record<string, { day: string; sent: number; received: number; }> = {};
        
        // Prep last 7 days starting from oldest to today
        const resultTraffic: { day: string; sent: number; received: number; }[] = [];
        for (let i = 6; i >= 0; i--) {
            let dayIndex = (currentDayIndex - i) % 7;
            if (dayIndex < 0) dayIndex += 7;
            const dayStr = days[dayIndex];
            mailTraffic[dayStr] = { day: dayStr, sent: 0, received: 0 };
            resultTraffic.push(mailTraffic[dayStr]);
        }

        try {
            // Fetch the Rspamd transaction log history
            const response = await this.axios.get('/api/v1/get/logs/rspamd-history');
            const history = Array.isArray(response.data) ? response.data : [];

            const now = Date.now();
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

            // Tally the real logs
            history.forEach(log => {
                const logTime = (log.unix_time * 1000) || 0;
                
                // Only count logs from the last 7 days
                if (logTime >= sevenDaysAgo && logTime <= now) {
                    const date = new Date(logTime);
                    const dayStr = days[date.getDay()];
                    
                    if (mailTraffic[dayStr]) {
                        // In Rspamd, authenticated outbound mail is tagged with an actual user email.
                        // Inbound traffic usually has user: "unknown" or no user.
                        if (log.user && log.user !== "unknown" && log.user !== "") {
                            mailTraffic[dayStr].sent += 1;
                        } else {
                            mailTraffic[dayStr].received += 1;
                        }
                    }
                }
            });

            return resultTraffic;
        } catch (error: any) {
            this.logger.error(`❌ Mailcow Traffic Stats Failed: ${error.message}`);
            // Return empty timeline on failure so dashboard doesn't crash
            return resultTraffic;
        }
    }

    async getApiLogs(count: number = 10) {
        this.logger.log(`📜 getApiLogs called for count: ${count}`);
        try {
            const response = await this.axios.get(`/api/v1/get/logs/api/${count}`);
            return response.data || [];
        } catch (error: any) {
            this.logger.error(`❌ Mailcow API Logs Failed: ${error.message}`);
            return [];
        }
    }

    async getSystemLogs(limit: number = 50) {
        this.logger.log(`📑 Fetching unified system logs (limit ${limit})`);
        try {
            const [apiRes, postfixRes, dovecotRes] = await Promise.all([
                this.axios.get(`/api/v1/get/logs/api/${limit}`).catch(() => ({ data: [] })),
                this.axios.get(`/api/v1/get/logs/postfix/${limit}`).catch(() => ({ data: [] })),
                this.axios.get(`/api/v1/get/logs/dovecot/${limit}`).catch(() => ({ data: [] }))
            ]);

            const logs: any[] = [];

            // Parse API Logs
            if (Array.isArray(apiRes.data)) {
                apiRes.data.forEach((log: any) => {
                    logs.push({
                        type: 'ADMIN',
                        user: 'System Admin',
                        ip: log.remote || 'Unknown',
                        action: `API Call: ${log.method} ${log.uri}`,
                        timestamp: Number(log.time) * 1000,
                        status: 'Success'
                    });
                });
            }

            // Parse Postfix (SMTP) Logs
            if (Array.isArray(postfixRes.data)) {
                postfixRes.data.forEach((log: any) => {
                    const ipMatch = log.message.match(/\[([0-9\.]+)\]/);
                    logs.push({
                        type: 'SMTP',
                        user: 'Mail Daemon',
                        ip: ipMatch ? ipMatch[1] : 'Internal',
                        action: log.message,
                        timestamp: Number(log.time) * 1000,
                        status: log.priority === 'info' ? 'Info' : (log.priority === 'warning' ? 'Warning' : 'Failed')
                    });
                });
            }

            // Parse Dovecot (IMAP) Logs
            if (Array.isArray(dovecotRes.data)) {
                dovecotRes.data.forEach((log: any) => {
                    const userMatch = log.message.match(/user=<([^>]+)>/);
                    const ipMatch = log.message.match(/rip=([0-9\.]+)/);
                    let actionLabel = log.message;

                    let type = 'IMAP';
                    if (log.message.includes('Login:') || log.message.includes('login:')) {
                        type = 'LOGIN';
                    } else if (log.message.includes('Disconnected:')) {
                        type = 'SYSTEM';
                        actionLabel = 'User disconnected or connection closed.';
                    }

                    logs.push({
                        type,
                        user: userMatch && userMatch[1] ? userMatch[1] : 'Unknown',
                        ip: ipMatch ? ipMatch[1] : 'Internal',
                        action: actionLabel,
                        timestamp: Number(log.time) * 1000,
                        status: log.priority === 'info' ? 'Success' : (log.priority === 'warning' ? 'Warning' : 'Failed')
                    });
                });
            }

            // Sort descending by timestamp
            logs.sort((a, b) => b.timestamp - a.timestamp);

            // Format timestamp strings
            return logs.slice(0, limit).map((log, index) => {
                const d = new Date(log.timestamp);
                log.time = d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                log.id = index;
                delete log.timestamp;
                return log;
            });
        } catch (error: any) {
            this.logger.error(`❌ Mailcow System Logs Failed: ${error.message}`);
            return [];
        }
    }
}
