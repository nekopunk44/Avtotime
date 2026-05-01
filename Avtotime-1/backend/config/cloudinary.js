import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

let configured = false;
const configureCloudinary = () => {
    if (configured) return;
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return;
    }

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    configured = true;
};

const isCloudinaryConfigured = () =>
    Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        if (!isCloudinaryConfigured()) return null;
        configureCloudinary();

        const result = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        });

        // Delete local temp file after successful upload (multer saves into ./public).
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        return result.secure_url;
    } catch (error) {
        // Cloudinary upload failed; keep local file for fallback (/api/public).
        return null;
    }
};

export const deleteFromCloudinary = async (url) => {
  if (!url || !isCloudinaryConfigured()) return;
  try {
    configureCloudinary();
    const parts = url.split('/upload/');
    if (parts.length < 2) return;
    const afterUpload = parts[1].replace(/^v\d+\//, '');
    const publicId = afterUpload.replace(/\.[^.]+$/, '');
    if (!publicId) return;
    const resourceType = url.includes('/video/') ? 'video' : url.includes('/raw/') ? 'raw' : 'image';
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch {
    // ignore cleanup failures
  }
};

export default uploadOnCloudinary;
