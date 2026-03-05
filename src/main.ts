import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    // 1. Global Validation Pipe
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));

    // 2. Cookie Parser
    app.use(cookieParser());

    // 3. CORS for frontend integration
    app.enableCors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
    });

    const port = process.env.PORT || 4000;
    await app.listen(port, '0.0.0.0');

    logger.log(`🚀 KSA Mail Backend running on: http://localhost:${port}`);
    logger.log(`───────────────────────────────────────────────`);
    logger.log(`📋 Environment Check:`);
    logger.log(`   NODE_ENV:          ${process.env.NODE_ENV || 'not set'}`);
    logger.log(`   FRONTEND_URL:      ${process.env.FRONTEND_URL || 'http://localhost:3000 (default)'}`);
    logger.log(`   DATABASE_URL:      ${process.env.DATABASE_URL ? '✅ Set' : '❌ NOT SET'}`);
    logger.log(`   JWT_SECRET:        ${process.env.JWT_SECRET ? '✅ Set' : '❌ NOT SET'}`);
    logger.log(`   MAILCOW_BASE_URL:  ${process.env.MAILCOW_BASE_URL || '❌ NOT SET'}`);
    logger.log(`   MAILCOW_API_KEY:   ${process.env.MAILCOW_API_KEY ? '✅ Set' : '❌ NOT SET'}`);
    logger.log(`   AUTHENTICA_API_URL:${process.env.AUTHENTICA_API_URL || '❌ NOT SET'}`);
    logger.log(`   AUTHENTICA_API_KEY:${process.env.AUTHENTICA_API_KEY && process.env.AUTHENTICA_API_KEY !== 'YOUR_AUTHENTICA_API_KEY_HERE' ? '✅ Set' : '❌ NOT SET or PLACEHOLDER'}`);
    logger.log(`───────────────────────────────────────────────`);
}
bootstrap();
