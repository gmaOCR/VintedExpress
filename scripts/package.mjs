import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const distDir = path.join(root, 'dist');
const releaseDir = path.join(root, 'release');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'manifest.json'))) {
  console.error('dist/ is missing. Run: npm run build');
  process.exit(1);
}

fs.mkdirSync(releaseDir, { recursive: true });
const baseName = `VintedExpress-${pkg.version}`;
const zipPath = path.join(releaseDir, `${baseName}.zip`);

try {
  // Use system zip to avoid adding deps; working directory = dist
  execFileSync('zip', ['-r', zipPath, '.'], { cwd: distDir, stdio: 'inherit' });
  console.log(`Created ${path.relative(root, zipPath)}`);
} catch (e) {
  console.error('Failed to create zip. Ensure the "zip" CLI is installed.');
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
}

// Copy helpful docs next to the zip (optional, not included in the zip)
try {
  const files = ['README.md', 'CHANGELOG.md'];
  for (const f of files) {
    const src = path.join(root, f);
    if (fs.existsSync(src)) {
      const dst = path.join(releaseDir, `${baseName}-${f}`);
      fs.copyFileSync(src, dst);
    }
  }
} catch {}
