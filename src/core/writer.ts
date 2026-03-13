import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { loadConfig } from './config.js';

const DEFAULT_BACKUP_DIR = '.argent/backups';

function getBackupPath(backupDir: string, filePath: string): string {
  const normalizedPath = path.normalize(filePath);
  const parsed = path.parse(normalizedPath);
  const drivePrefix = parsed.root.replace(/[:\\/]+/g, '').trim();
  const relativeRoot = drivePrefix ? path.join(drivePrefix, parsed.dir.slice(parsed.root.length)) : parsed.dir;
  const safeDir = relativeRoot || '_root';
  const timestamp = Date.now();

  return path.join(backupDir, safeDir, `${parsed.base}.${timestamp}.bak`);
}

function isMissingFileError(err: unknown): boolean {
  return Boolean(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code?: unknown }).code === 'string' &&
    (err as { code: string }).code === 'ENOENT',
  );
}

export async function applyChanges(filePath: string, newContent: string): Promise<void> {
  const config = await loadConfig();
  const backupDir = config.backupDir ?? DEFAULT_BACKUP_DIR;

  try {
    const existing = await fs.readFile(filePath, 'utf-8');
    const backupPath = getBackupPath(backupDir, filePath);
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.writeFile(backupPath, existing, 'utf-8');
    logger.info(`Backup saved to ${backupPath}`);
  } catch (err) {
    if (!isMissingFileError(err)) {
      throw err;
    }
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, newContent, 'utf-8');
}
