import { Module } from '@nestjs/common';
import { BannerService } from './banner.service';
import { BannerController } from './banner.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [PrismaModule, AuthModule, JwtModule],
    providers: [BannerService],
    controllers: [BannerController],
    exports: [BannerService],
})
export class BannerModule {}
