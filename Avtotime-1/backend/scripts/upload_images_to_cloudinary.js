import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env: prefer .env.production (server), fall back to .env (local dev)
const envProd = path.join(__dirname, '..', '..', '.env.production');
const envDev  = path.join(__dirname, '..', '.env');
dotenv.config({ path: fs.existsSync(envProd) ? envProd : envDev });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.error('❌ Cloudinary credentials not found in env');
    process.exit(1);
}

// Optional MongoDB — only needed to update imageUrl on existing DB records.
// If MONGODB_URL is not set, images are still uploaded; DB update is skipped.
let DrivingQuestion = null;
if (process.env.MONGODB_URL) {
    const drivingQuestionSchema = new mongoose.Schema({
        ticketNumber: Number,
        questionNumber: Number,
        imageUrl: String,
    }, { strict: false });
    DrivingQuestion = mongoose.model('DrivingQuestion', drivingQuestionSchema);

    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.warn('⚠️  MongoDB connection failed — images will be uploaded but DB will not be updated:', err.message);
        DrivingQuestion = null;
    }
} else {
    console.log('ℹ️  MONGODB_URL not set — DB update will be skipped');
}

// Resolve tickets folder: script lives at backend/scripts/, images at frontend_market/public/tickets/
// Try several candidate paths to work from any CWD.
const candidatePaths = [
    path.join(__dirname, '..', '..', '..', 'frontend_market', 'public', 'tickets'),
    path.join(__dirname, '..', '..', 'frontend_market', 'public', 'tickets'),
    path.join(process.cwd(), 'frontend_market', 'public', 'tickets'),
];
const ticketsPath = candidatePaths.find(p => fs.existsSync(p));

if (!ticketsPath) {
    console.error('❌ Tickets folder not found. Tried:');
    candidatePaths.forEach(p => console.error('   ', p));
    process.exit(1);
}
console.log(`📂 Tickets folder: ${ticketsPath}`);

async function uploadImage(localPath, publicId) {
    try {
        const result = await cloudinary.uploader.upload(localPath, {
            resource_type: 'image',
            folder: 'driving-questions',
            public_id: publicId,
            overwrite: false,       // skip if already uploaded
            invalidate: false,
        });
        return result.secure_url;
    } catch (err) {
        // "already exists" is not a real error when overwrite=false
        if (err?.error?.http_code === 400 && err?.error?.message?.includes('already exists')) {
            return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/driving-questions/${publicId}`;
        }
        console.error(`  ❌ Upload failed (${localPath}):`, err?.message || err);
        return null;
    }
}

let totalUploaded = 0;
let totalAlreadyExist = 0;
let totalFailed = 0;
let totalDbUpdated = 0;

for (let ticketNum = 1; ticketNum <= 40; ticketNum++) {
    const ticketFolder = path.join(ticketsPath, `ticket${ticketNum}`);
    if (!fs.existsSync(ticketFolder)) continue;

    const files = fs.readdirSync(ticketFolder)
        .filter(f => /^(question)?\d+\.(png|jpg|jpeg|webp|gif)$/i.test(f))
        .sort();

    if (files.length === 0) continue;
    console.log(`\n📁 ticket${ticketNum}: ${files.length} images`);

    for (const file of files) {
        const match = file.match(/^(?:question)?(\d+)\./i);
        if (!match) { console.log(`  ⚠️  Skip (unrecognized name): ${file}`); continue; }
        const questionNum = parseInt(match[1], 10);
        const localPath   = path.join(ticketFolder, file);
        const publicId    = `ticket${ticketNum}_q${questionNum}`;

        process.stdout.write(`  📤 ticket${ticketNum}/q${questionNum} … `);
        const url = await uploadImage(localPath, publicId);

        if (!url) {
            console.log('FAILED');
            totalFailed++;
            continue;
        }

        if (url.includes('driving-questions/' + publicId)) {
            // File already existed on Cloudinary (overwrite=false returned same URL pattern)
            console.log('already on Cloudinary');
            totalAlreadyExist++;
        } else {
            console.log('uploaded ✅');
            totalUploaded++;
        }

        // Update DB record if MongoDB is connected
        if (DrivingQuestion) {
            try {
                const result = await DrivingQuestion.updateOne(
                    { ticketNumber: ticketNum, questionNumber: questionNum },
                    { $set: { imageUrl: url } }
                );
                if (result.matchedCount > 0) totalDbUpdated++;
            } catch (err) {
                console.warn(`  ⚠️  DB update failed for ticket${ticketNum}/q${questionNum}:`, err.message);
            }
        }
    }
}

console.log('\n══════════════ Summary ══════════════');
console.log(`  Uploaded:           ${totalUploaded}`);
console.log(`  Already on CDN:     ${totalAlreadyExist}`);
console.log(`  Failed:             ${totalFailed}`);
if (DrivingQuestion) console.log(`  DB records updated: ${totalDbUpdated}`);
console.log('═════════════════════════════════════');

if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
}
