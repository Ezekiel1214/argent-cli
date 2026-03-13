import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

function isMissingFileError(err: unknown): boolean {
  return Boolean(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code?: unknown }).code === 'string' &&
    (err as { code: string }).code === 'ENOENT',
  );
}

export async function init(): Promise<void> {
  const configPath = path.join(process.cwd(), '.argentrc.json');

  try {
    try {
      await fs.access(configPath);
      logger.warn('.argentrc.json already exists.');
      return;
    } catch (err) {
      if (!isMissingFileError(err)) {
        throw err;
      }
    }

    const defaultConfig = {
      autoDeploy: false,
      backupDir: '.argent/backups',
      deployProvider: 'vercel',
    };

    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    logger.success('Created .argentrc.json with default configuration.');
  } catch (err: unknown) {
    logger.error((err as Error).message);
  }
}
