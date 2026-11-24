import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const directory of ['dist', 'dist-server']) {
  fs.rmSync(path.join(projectRoot, directory), { recursive: true, force: true });
}

process.stdout.write('Removed dist and dist-server.\n');
