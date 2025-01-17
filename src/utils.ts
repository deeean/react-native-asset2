import fs from 'fs/promises';
import path from 'path';

export interface Asset {
  path: string;
  basename: string;
  extname: string;
}

const ignoreFiles = [
  '.DS_Store',
  'Thumbs.db',
];

export const readAssets = async (dir: string, assets: Array<Asset> = []) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      await readAssets(path.join(dir, entry.name), assets);
    } else {
      if (ignoreFiles.includes(entry.name)) {
        continue;
      }

      assets.push({
        path: path.resolve(path.join(dir, entry.name)),
        basename: entry.name,
        extname: path.extname(entry.name),
      });
    }
  }

  return assets;
}
