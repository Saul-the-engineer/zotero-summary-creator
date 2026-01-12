#!/usr/bin/env node

// Build script to create .xpi file for Zotero extension

import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ADDON_DIR = join(__dirname, 'addon');
const BUILD_DIR = join(__dirname, 'build');
const OUTPUT_FILE = join(BUILD_DIR, 'zotero-summary-creator.xpi');

async function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = await readdir(dirPath);

  for (const file of files) {
    const filePath = join(dirPath, file);
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      arrayOfFiles = await getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  }

  return arrayOfFiles;
}

async function build() {
  console.log('Building Zotero Summary Creator extension...\n');

  // Create build directory
  if (!existsSync(BUILD_DIR)) {
    mkdirSync(BUILD_DIR, { recursive: true });
  }

  // Create archive
  const output = createWriteStream(OUTPUT_FILE);
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  output.on('close', () => {
    const size = (archive.pointer() / 1024).toFixed(2);
    console.log(`✓ Built: ${OUTPUT_FILE}`);
    console.log(`✓ Size: ${size} KB`);
    console.log('\nTo install:');
    console.log('  1. Open Zotero');
    console.log('  2. Go to Tools → Add-ons');
    console.log('  3. Click the gear icon → Install Add-on From File...');
    console.log(`  4. Select: ${OUTPUT_FILE}\n`);
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);

  // Add all files from addon directory
  const files = await getAllFiles(ADDON_DIR);

  for (const file of files) {
    const relativePath = relative(ADDON_DIR, file);
    console.log(`  Adding: ${relativePath}`);
    archive.file(file, { name: relativePath });
  }

  await archive.finalize();
}

build().catch(console.error);
