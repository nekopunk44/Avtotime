import multer from 'multer'
import fs from 'fs'

const dir = './public';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, dir)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + '-' + file.originalname)
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
