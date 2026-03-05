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
                quota: quotaMB,
                active: '1',
            };

            this.logger.debug(`Mailcow payload: ${JSON.stringify({ ...payload, password: '***' })}`);
            const response = await this.axios.post('/api/v1/add/mailbox', payload);

            this.logger.log(`Mailcow response status: ${response.status}`);
            this.logger.debug(`Mailcow response data: ${JSON.stringify(response.data)}`);

            if (response.data[0]?.type === 'error' || response.status !== 200) {
                const msg = response.data[0]?.msg || 'Mailcow API error';
                this.logger.error(`❌ Mailcow error response: ${msg}`);
                throw new Error(msg);
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
            this.logger.log(`✅ Mailbox deleted: ${email}`);
            return response.data;
        } catch (error: any) {
            this.logger.error(`❌ Mailcow Deletion Failed: ${error.message}`);
            throw new InternalServerErrorException(`Mailcow Deletion Failed: ${error.message}`);
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
            throw new InternalServerErrorException(`Mailcow Listing Failed: ${error.message}`);
        }
    }
}
