import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SponsorService } from './sponsor.service';
import { CreateSponsorDto, UpdateSponsorDto } from './sponsor.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../auth/auth.dto';

@Controller('sponsors')
export class SponsorController {
    constructor(private readonly sponsorService: SponsorService) {}

    // Public endpoint for SnappyMail UI
    @Get('active')
    async getActiveSponsors() {
        return this.sponsorService.findActive();
    }

    // Admin endpoints
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getAllSponsors() {
        return this.sponsorService.findAll();
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async createSponsor(@Body() data: CreateSponsorDto) {
        return this.sponsorService.create(data);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async updateSponsor(@Param('id') id: string, @Body() data: UpdateSponsorDto) {
        return this.sponsorService.update(id, data);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async deleteSponsor(@Param('id') id: string) {
        return this.sponsorService.remove(id);
    }

    @Post('upload')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                return cb(null, `${randomName}${extname(file.originalname)}`);
            }
        }),
        fileFilter: (req, file, cb) => {
            if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                return cb(new Error('Only image files are allowed!'), false);
            }
            cb(null, true);
        }
    }))
    async uploadImage(@UploadedFile() file: any) {
        // Return full relative URL mapping statically to uploads/
        return {
            url: `/uploads/${file.filename}`
        };
    }
}
