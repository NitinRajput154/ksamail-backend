import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateSupportTicketDto, UpdateSupportTicketDto } from './support.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../auth/auth.dto';

@Controller('support')
export class SupportController {
    constructor(private readonly supportService: SupportService) {}

    // Public endpoint for SnappyMail UI users
    @Post()
    async createTicket(@Body() data: CreateSupportTicketDto) {
        return this.supportService.create(data);
    }

    // Admin endpoints
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getAllTickets() {
        return this.supportService.findAll();
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async updateTicket(@Param('id') id: string, @Body() data: UpdateSupportTicketDto) {
        return this.supportService.update(id, data);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async deleteTicket(@Param('id') id: string) {
        return this.supportService.remove(id);
    }
}
