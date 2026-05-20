/**
 * merge-build.js
 * After Vite builds the React app to app/dist/,
 * this script renames the React index.html → _app.html
 * and copies all static website files into app/dist/
 * so Vercel serves everything from one domain.
 */
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'app', 'dist');
const WEBSITE = path.resolve(__dirname, '..', 'mybuddymaid');

// 1. Rename React's index.html → _app.html
const reactIndex = path.join(DIST, 'index.html');
const appHtml = path.join(DIST, '_app.html');
if (fs.existsSync(reactIndex)) {
  fs.renameSync(reactIndex, appHtml);
  console.log('✓ Renamed index.html → _app.html');
}

// 2. Copy all website files into dist/ (skip folders like .git, node_modules)
const SKIP = new Set(['.git', 'node_modules', '.DS_Store']);

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      // Don't overwrite existing files from the React build (like assets/)
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

copyRecursive(WEBSITE, DIST);
console.log('✓ Copied website files into dist/');
console.log('✓ Build merge complete!');
