import { Router } from 'express';
import multer from 'multer';
import { allowed, currentUser } from '../../platform/auth.js';
import { badRequest, forbidden, notFound } from '../../platform/errors.js';
import { objectId, route } from '../../platform/http.js';
import { FILE_PURPOSES, FileUpload, type FilePurpose } from './model.js';
import { BRANDING_TYPES, MAX_FILE_BYTES, fileDto, mayReadFile, sniffContentType } from './service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

const router = Router();

router.post(
  '/',
  upload.single('file'),
  route(async (req, res) => {
    const purpose = req.body?.purpose as FilePurpose;
    if (!FILE_PURPOSES.includes(purpose)) throw badRequest('Say what the file is for.');
    // Logos, chops and signatures end up on customer documents; only an admin sets them.
    if (purpose === 'branding' && !allowed(req, 'settings.manage')) throw forbidden();
    if (!req.file || req.file.size === 0) throw badRequest('Choose a file to upload.');

    const contentType = sniffContentType(req.file.buffer);
    if (!contentType) throw badRequest('Upload a PNG, JPEG, GIF or WebP image, or a PDF.');
    if (purpose === 'branding' && !BRANDING_TYPES.includes(contentType)) {
      throw badRequest('Logos, chops and signatures must be PNG or JPEG images.');
    }

    const file = await FileUpload.create({
      filename: (req.file.originalname || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 120),
      contentType,
      size: req.file.size,
      data: req.file.buffer,
      purpose,
      uploadedBy: currentUser(req)._id,
    });
    res.status(201).json(fileDto(file));
  }),
);

router.get(
  '/:id',
  route(async (req, res) => {
    const file = await FileUpload.findById(objectId(req.params.id, 'That file')).select('+data');
    if (!file) throw notFound('That file');
    // Same answer as "not found", so ids cannot be probed.
    if (!mayReadFile(currentUser(req), file)) throw notFound('That file');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename.replace(/"/g, '')}"`);
    res.setHeader('Content-Length', String(file.data.length));
    res.send(file.data);
  }),
);

export default router;
