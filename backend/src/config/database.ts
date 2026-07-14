import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

dotenv.config();

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

// Verify database connectivity on startup
prisma.$connect()
    .then(() => {
        console.log('✅ Database connected successfully');
    })
    .catch((error: Error) => {
        console.error('❌ Failed to connect to database:', error.message);
        process.exit(1); // Exit so nodemon/deployment knows something is wrong
    });

export default prisma;
