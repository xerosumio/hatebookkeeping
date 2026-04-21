import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { FileUpload } from '../models/FileUpload.js';

const router = Router();

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'File type not allowed') as any);
    }
  },
});

router.post('/', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'No file uploaded');
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    const contentType = MIME_MAP[ext] || req.file.mimetype;
    const doc = await FileUpload.create({
      filename: req.file.originalname,
      contentType,
      data: req.file.buffer,
      size: req.file.size,
    });
    res.json({ path: `/api/uploads/${doc._id}` });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next();
    }
    const doc = await FileUpload.findById(req.params.id);
    if (!doc) {
      return next();
    }
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Length', doc.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(doc.data);
  } catch (error) {
    next(error);
  }
});

export default router;
