import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

dotenv.config();

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string)
const prisma = new PrismaClient({ adapter });

export default prisma;