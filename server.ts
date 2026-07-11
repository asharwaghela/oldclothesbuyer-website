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

async function ensureAssets() {
  const assets = [
    'images/logo.webp',
    'logo.webp',
    'favicon.ico',
    'images/favicon.ico',
    'images/Image1.jpg'
  ];

  for (const relPath of assets) {
    const mainSrc = path.join(process.cwd(), relPath);
    
    // Ensure in publicDir (which could be dist/public in prod)
    if (publicDir !== process.cwd()) {
      const prodDest = path.join(publicDir, relPath);
      if (!fs.existsSync(prodDest)) {
        if (fs.existsSync(mainSrc)) {
          console.log(`[Assets] Syncing local asset to prod/dist folder: ${prodDest}`);
          const prodDir = path.dirname(prodDest);
          if (!fs.existsSync(prodDir)) {
            fs.mkdirSync(prodDir, { recursive: true });
          }
          fs.copyFileSync(mainSrc, prodDest);
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
