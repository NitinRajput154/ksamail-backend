const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@ksamail.com';
    const password = 'testpassword123!';
    
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
        where: { email }
    });

    if (existingAdmin) {
        console.log('Admin already exists.');
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
        data: {
            name: 'Super Admin',
            username: 'admin',
            email: email,
            password: hashedPassword,
            role: 'ADMIN',
            phone: '1234567890',
            emailVerified: true,
            phoneVerified: true
        }
    });

    console.log('Admin created:', admin);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
