import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { MailboxModule } from './mailbox/mailbox.module';
import { MailcowModule } from './mailcow/mailcow.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        PrismaModule,
        AuthModule,
        MailboxModule,
        MailcowModule,
        UsersModule,
    ],
})
export class AppModule { }
