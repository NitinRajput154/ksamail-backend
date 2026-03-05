import { Module } from '@nestjs/common';
import { MailboxService } from './mailbox.service';
import { MailboxController } from './mailbox.controller';
import { MailcowModule } from '../mailcow/mailcow.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule, MailcowModule],
    providers: [MailboxService],
    controllers: [MailboxController],
})
export class MailboxModule { }
