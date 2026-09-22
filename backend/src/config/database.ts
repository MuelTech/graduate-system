import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

dotenv.config();

// Define global object for caching Prisma instance in Next.js
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
};

let prisma: PrismaClient;

if (!globalForPrisma.prisma) {
  const connectionString = (process.env.DATABASE_URL as string).replace('mysql://', 'mariadb://');
  const adapter = new PrismaMariaDb(connectionString);
  globalForPrisma.prisma = new PrismaClient({ adapter });
  
  // Verify database connectivity only on initial load
  globalForPrisma.prisma.$connect()
      .then(() => {
          console.log('✅ Database connected successfully');
      })
      .catch((error: Error) => {
          console.error('❌ Failed to connect to database:', error.message);
      });
}

prisma = globalForPrisma.prisma;

export default prisma;
