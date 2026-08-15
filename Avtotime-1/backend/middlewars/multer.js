import multer from 'multer'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const dir = './public';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, dir)
    },
    filename: (req, file, cb) => {
        // Files under ./public are served without auth from /api/public, so the
        // name must be an unguessable capability URL — never the original name.
        const ext = path.extname(file.originalname || '').slice(0, 10).replace(/[^.a-zA-Z0-9]/g, '')
        cb(null, `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`)
    }
})

const fileFilter = (req, file, cb) => {
    const allowed = /^(image\/(jpeg|png|gif|webp|avif)|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp3|wav|ogg|aac|webm|mp4)|application\/(pdf|zip|x-7z-compressed|x-rar-compressed|msword|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation))|text\/plain)$/
    if (allowed.test(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new Error('Разрешены изображения, видео и файлы (PDF/DOCX/XLSX/ZIP/аудио)'), false)
    }
}

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 },
})
