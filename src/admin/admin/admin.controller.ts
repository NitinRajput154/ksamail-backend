import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../auth/auth.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get('stats/overview')
    @Roles(Role.ADMIN)
    async getDashboardStats() {
        return this.adminService.getDashboardStats();
    }

    @Get('stats/health')
    @Roles(Role.ADMIN)
    async getSystemHealth() {
        return this.adminService.getSystemHealth();
    }

    @Get('logs')
    @Roles(Role.ADMIN)
    async getSystemLogs() {
        // fetching 200 items for a dense view
        return this.adminService.getSystemLogs(200);
    }

    @Get('security')
    @Roles(Role.ADMIN)
    async getSecurityData() {
        return this.adminService.getSecurityData();
    }

    @Post('security/unban')
    @Roles(Role.ADMIN)
    async unbanIp(@Body('ip') ip: string) {
        return this.adminService.unbanIp(ip);
    }

    @Get('users')
    @Roles(Role.ADMIN)
    async getAllAdmins() {
        return this.adminService.getAllAdmins();
    }

    @Post('users')
    @Roles(Role.ADMIN)
    async inviteAdmin(@Body() data: any) {
        return this.adminService.inviteAdmin(data);
    }

    @Delete('users/:id')
    @Roles(Role.ADMIN)
    async deleteAdmin(@Param('id') id: string) {
        return this.adminService.deleteAdmin(id);
    }
}
