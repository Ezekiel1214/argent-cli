import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

export async function init(): Promise<void> {
  const configPath = path.join(process.cwd(), '.argentrc.json');

  try {
    await fs.access(configPath);
    logger.warn('.argentrc.json already exists.');
    return;
  } catch {
    // Continue and create config.
  }

  const defaultConfig = {
    autoDeploy: false,
    backupDir: '.argent/backups',
    deployProvider: 'vercel',
  };

  await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  logger.success('Created .argentrc.json with default configuration.');
}
