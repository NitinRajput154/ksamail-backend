import { Controller, Get, UseGuards, Request } from '@nestjs/common';
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
}
