const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const email = 'test@ksamail.com';
    const pwd = await bcrypt.hash('password123', 10);
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            recoveryEmail: 'test-recovery@example.com',
            phone: '+1234567890'
        },
        create: {
            name: 'Test User',
            username: 'test',
            email: email,
            password: pwd,
            recoveryEmail: 'test-recovery@example.com',
            phone: '+1234567890'
        }
    });
    console.log("Seeded user:", user.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
