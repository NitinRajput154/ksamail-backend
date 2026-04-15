import { Controller, Get, UseGuards, Request, Post, Param, Body, Delete } from '@nestjs/common';
import { MailboxService } from './mailbox.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../auth/auth.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('mailbox')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MailboxController {
    constructor(private mailboxService: MailboxService) { }

    @Get('all')
    @Roles(Role.ADMIN)
    async getAll() {
        return this.mailboxService.getAll();
    }

    @Get('me')
    async getMyMailboxes(@Request() req) {
        return this.mailboxService.getByUser(req.user.sub);
    }

    @Post(':email/suspend')
    @Roles(Role.ADMIN)
    async suspendMailbox(@Param('email') email: string) {
        return this.mailboxService.suspendMailbox(email);
    }

    @Post(':email/activate')
    @Roles(Role.ADMIN)
    async activateMailbox(@Param('email') email: string) {
        return this.mailboxService.activateMailbox(email);
    }

    @Post(':email/reset-password')
    @Roles(Role.ADMIN)
    async resetPassword(@Param('email') email: string, @Body() body: any) {
        return this.mailboxService.resetPassword(email, body.password);
    }

    @Delete(':email')
    @Roles(Role.ADMIN)
    async deleteMailbox(@Param('email') email: string) {
        return this.mailboxService.deleteMailbox(email);
    }

    @Post(':email/update-quota')
    @Roles(Role.ADMIN)
    async updateQuota(@Param('email') email: string, @Body() body: any) {
        return this.mailboxService.updateQuota(email, body.quota);
    }

    @Post('add')
    @Roles(Role.ADMIN)
    async createMailbox(@Body() body: any) {
        return this.mailboxService.createMailbox(body);
    }
}
