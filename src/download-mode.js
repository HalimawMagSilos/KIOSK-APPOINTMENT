// download-models.js
// Run this script with Node.js to download face-api.js model files
// Usage: node download-models.js

import fs from 'fs';
import https from 'https';
import path from 'path';

const BASE_URL =
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const MODEL_FILES = [
  // SSD MobileNetV1 (Face Detection)
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',

  // Face Landmark 68 (already have, but included for completeness)
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',

  // Face Recognition (already have, but included for completeness)
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

const OUTPUT_DIR = './public/models';

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`✅ Created directory: ${OUTPUT_DIR}`);
}

function downloadFile(filename) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + filename;
    const outputPath = path.join(OUTPUT_DIR, filename);

    // Check if file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`⏭️  Skipped (already exists): ${filename}`);
      resolve();
      return;
    }

    console.log(`⬇️  Downloading: ${filename}...`);

    https
      .get(url, response => {
        if (response.statusCode === 200) {
          const fileStream = fs.createWriteStream(outputPath);
          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            console.log(`✅ Downloaded: ${filename}`);
            resolve();
          });
        } else {
          reject(
            new Error(`Failed to download ${filename}: ${response.statusCode}`)
          );
        }
      })
      .on('error', err => {
        reject(err);
      });
  });
}

async function downloadAllModels() {
  console.log('🚀 Starting model download...\n');
  console.log(`📁 Output directory: ${OUTPUT_DIR}\n`);

  for (const filename of MODEL_FILES) {
    try {
      await downloadFile(filename);
    } catch (error) {
      console.error(`❌ Error downloading ${filename}:`, error.message);
    }
  }

  console.log('\n✅ All downloads complete!');
  console.log('\n📋 Downloaded files:');

  const files = fs.readdirSync(OUTPUT_DIR);
  files.forEach(file => {
    const filePath = path.join(OUTPUT_DIR, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   - ${file} (${sizeKB} KB)`);
  });
}

downloadAllModels().catch(console.error);
