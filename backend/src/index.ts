import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Graduate School System API is running' });
});

// Import routes
// import authRoutes from './routes/auth';
// import studentRoutes from './routes/students';
// import thesisRoutes from './routes/thesis';
// import admissionRoutes from './routes/admissions';

// Use routes
// app.use('/api/auth', authRoutes);
// app.use('/api/students', studentRoutes);
// app.use('/api/thesis', thesisRoutes);
// app.use('/api/admissions', admissionRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

export { prisma };
