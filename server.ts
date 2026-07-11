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

// Resolve public folder: check for dist/public first, otherwise use public
const publicDir = fs.existsSync(path.join(process.cwd(), 'dist', 'public'))
  ? path.join(process.cwd(), 'dist', 'public')
  : path.join(process.cwd(), 'public');

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
  if (!fs.existsSync(filePath)) {
    return false;
  }
  if (filePath.endsWith('.ico')) {
    try {
      return fs.statSync(filePath).size > 100;
    } catch {
      return false;
    }
  }
  try {
    execSync(`identify "${filePath}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function ensureAssets() {
  const assets = [
    { url: 'https://oldclothesbuyer.com/images/logo.webp', relPath: 'images/logo.webp' },
    { url: 'https://oldclothesbuyer.com/logo.webp', relPath: 'logo.webp' },
    { url: 'https://oldclothesbuyer.com/logo.png', relPath: 'images/logo.png' },
    { url: 'https://oldclothesbuyer.com/logo.png', relPath: 'logo.png' },
    { url: 'https://oldclothesbuyer.com/images/Image1.jpg', relPath: 'images/Image1.jpg' },
    { url: 'https://oldclothesbuyer.com/favicon.ico', relPath: 'favicon.ico' },
    { url: 'https://oldclothesbuyer.com/favicon.ico', relPath: 'images/favicon.ico' }
  ];

  for (const asset of assets) {
    const mainDest = path.join(process.cwd(), 'public', asset.relPath);
    
    // Ensure in public folder
    if (!isValidImage(mainDest)) {
      console.log(`[Assets] Asset missing or invalid/corrupted in public folder: ${mainDest}`);
      try {
        downloadFile(asset.url, mainDest);
      } catch (err) {
        console.error(`[Assets] Failed to download ${asset.url}:`, err);
      }
    }

    // Ensure in publicDir (which could be dist/public in prod)
    if (publicDir !== path.join(process.cwd(), 'public')) {
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
