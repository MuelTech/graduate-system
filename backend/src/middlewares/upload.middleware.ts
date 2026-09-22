import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { PRIVATE_UPLOAD_ROOT } from '../utils/file.utils';

const uploadDir = PRIVATE_UPLOAD_ROOT;

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, _file, cb) => {
        // Cryptographically random filename — never derive from user input
        const randomName = crypto.randomBytes(24).toString('hex');
        cb(null, randomName);
    }
});

export const upload = multer({
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // Default 5MB
    },
    // No MIME-based fileFilter here — trust nothing from the client.
    // Actual file-type validation happens in cor.service after upload.
});
