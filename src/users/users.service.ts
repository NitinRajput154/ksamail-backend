import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { mailboxes: true },
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async findAll() {
        return this.prisma.user.findMany({
            include: { mailboxes: true },
        });
    }
}
