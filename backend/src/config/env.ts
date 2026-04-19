import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hatebookkeeping',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  nodeEnv: process.env.NODE_ENV || 'development',
  emailApiUrl: process.env.EMAIL_API_URL || 'https://zog8wc804808wcgosgsgcs00.prod.wellplay.io',
  emailApiKey: process.env.EMAIL_API_KEY || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
