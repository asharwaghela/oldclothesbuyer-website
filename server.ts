/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

const app = express();
const PORT = 3000;

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url} - Referer: ${req.headers.referer || 'none'}`);
  next();
});

// Resolve public folder: check for dist/public first, otherwise use root directory
const publicDir = fs.existsSync(path.join(process.cwd(), 'dist', 'public'))
  ? path.join(process.cwd(), 'dist', 'public')
  : process.cwd();

console.log(`[Server] Serving static files from: ${publicDir}`);

function downloadFile(url: string, dest: string): void {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  console.log(`[Assets] Downloading ${url} -> ${dest}`);
  execSync(`curl -s -L -f -o "${dest}" "${url}"`);
}

function isValidImage(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const size = fs.statSync(filePath).size;
    if (size < 100) {
      return false;
    }

    // Read the first 16 bytes to check image signatures/magic numbers
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.webp') {
      // WEBP magic number: "RIFF" at 0-4, "WEBP" at 8-12
      const isRiff = buffer.toString('ascii', 0, 4) === 'RIFF';
      const isWebp = buffer.toString('ascii', 8, 12) === 'WEBP';
      return isRiff && isWebp;
    } else if (ext === '.png') {
      // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    } else if (ext === '.jpg' || ext === '.jpeg') {
      // JPEG magic number: FF D8 FF
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    } else if (ext === '.ico') {
      // ICO magic number: 00 00 01 00
      return buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00;
    }
    return true; // fallback for other files
  } catch {
    return false;
  }
}

async function ensureAssets() {
  const assets = [
    { url: 'https://oldclothesbuyer.com/logo.webp', relPath: 'images/logo.webp' },
    { url: 'https://oldclothesbuyer.com/logo.webp', relPath: 'logo.webp' },
    { url: 'https://oldclothesbuyer.com/favicon.ico', relPath: 'favicon.ico' },
    { url: 'https://oldclothesbuyer.com/favicon.ico', relPath: 'images/favicon.ico' },
    { url: 'https://oldclothesbuyer.com/images/Image1.jpg', relPath: 'images/Image1.jpg' }
  ];

  for (const asset of assets) {
    const mainDest = path.join(process.cwd(), asset.relPath);
    
    // Ensure in root folder
    if (!isValidImage(mainDest)) {
      console.log(`[Assets] Asset missing or invalid/corrupted in root folder: ${mainDest}`);
      try {
        downloadFile(asset.url, mainDest);
      } catch (err) {
        console.error(`[Assets] Failed to download ${asset.url}:`, err);
      }
    }

    // Ensure in publicDir (which could be dist/public in prod)
    if (publicDir !== process.cwd()) {
      const prodDest = path.join(publicDir, asset.relPath);
      if (!isValidImage(prodDest)) {
        console.log(`[Assets] Asset missing or invalid/corrupted in prod/dist folder: ${prodDest}`);
        const prodDir = path.dirname(prodDest);
        if (!fs.existsSync(prodDir)) {
          fs.mkdirSync(prodDir, { recursive: true });
        }
        if (isValidImage(mainDest)) {
          fs.copyFileSync(mainDest, prodDest);
        } else {
          try {
            downloadFile(asset.url, prodDest);
          } catch (err) {
            console.error(`[Assets] Failed to download to ${prodDest}:`, err);
          }
        }
      }
    }
  }
}

// Custom redirects from _redirects:
const redirectMap: Record<string, string> = {
  '/index.html': '/',
  '/prices': '/prices.html',
  '/thane': '/thane.html',
  '/navi-mumbai': '/navi-mumbai.html',
  '/textile-reuse-recycling-initiative': '/textile-reuse-recycling-initiative.html',
  '/sell-old-clothes-before-shifting-thane': '/sell-old-clothes-before-shifting-thane.html'
};

app.use((req, res, next) => {
  const url = req.url.split('?')[0];
  if (redirectMap[url]) {
    return res.redirect(301, redirectMap[url]);
  }
  next();
});

// Serve static files with .html extension fallback
// e.g., /thane will serve /thane.html, and / will serve index.html
app.use(express.static(publicDir, {
  extensions: ['html', 'htm'],
  index: 'index.html'
}));

// Fallback to custom 404.html if file not found
app.use((req, res) => {
  const file404 = path.join(publicDir, '404.html');
  if (fs.existsSync(file404)) {
    res.status(404).sendFile(file404);
  } else {
    res.status(404).send('404 Not Found');
  }
});

async function start() {
  await ensureAssets();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Web application is running live at http://0.0.0.0:${PORT}`);
  });
}
start();
