import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';
import { loadConfig } from '../core/config.js';
import { logger } from '../utils/logger.js';

interface DoctorOptions {
  json?: boolean;
}

interface DoctorReport {
  version: string;
  runtime: {
    node: string;
    platform: string;
    cwd: string;
  };
  config: {
    autoDeploy: boolean;
    backupDir: string;
  };
  files: {
    defaultMappingExists: boolean;
    configExists: boolean;
  };
  integrations: {
    vercelCliAvailable: boolean;
    vercelVersion?: string;
  };
  capabilities: {
    captureInputs: string[];
    captureFeatures: string[];
    applyFeatures: string[];
    buildFeatures: string[];
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getVercelStatus(): Promise<{ available: boolean; version?: string }> {
  try {
    const result = await execa('vercel', ['--version']);
    return {
      available: true,
      version: result.stdout.trim() || undefined,
    };
  } catch {
    return { available: false };
  }
}

export async function doctor(options: DoctorOptions = {}): Promise<void> {
  const config = await loadConfig();
  const vercel = await getVercelStatus();
  const report: DoctorReport = {
    version: '0.4.0',
    runtime: {
      node: process.version,
      platform: process.platform,
      cwd: process.cwd(),
    },
    config: {
      autoDeploy: Boolean(config.autoDeploy),
      backupDir: config.backupDir ?? '.argent/backups',
    },
    files: {
      defaultMappingExists: await fileExists(path.join('.argent', 'mapping.json')),
      configExists: await fileExists('.argentrc.json'),
    },
    integrations: {
      vercelCliAvailable: vercel.available,
      vercelVersion: vercel.version,
    },
    capabilities: {
      captureInputs: ['clipboard', 'stdin', 'file'],
      captureFeatures: ['plain-document fallback', 'heading splitting', 'default file', 'path inference', 'custom mapping output'],
      applyFeatures: ['single-file apply', 'custom mapping input', 'dry-run', 'require-changes', 'deploy'],
      buildFeatures: ['ingest-and-build', 'path inference', 'split headings', 'optional deploy'],
    },
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  logger.info(`argent ${report.version}`);
  logger.info(`Node ${report.runtime.node} on ${report.runtime.platform}`);
  logger.info(`Working directory: ${report.runtime.cwd}`);
  logger.info(`Config: autoDeploy=${report.config.autoDeploy} backupDir=${report.config.backupDir}`);
  logger.info(`Files: config=${report.files.configExists ? 'present' : 'missing'} mapping=${report.files.defaultMappingExists ? 'present' : 'missing'}`);
  logger.info(`Vercel CLI: ${report.integrations.vercelCliAvailable ? `available${report.integrations.vercelVersion ? ` (${report.integrations.vercelVersion})` : ''}` : 'missing'}`);
  logger.info(`Capture inputs: ${report.capabilities.captureInputs.join(', ')}`);
  logger.info(`Capture features: ${report.capabilities.captureFeatures.join(', ')}`);
  logger.info(`Apply features: ${report.capabilities.applyFeatures.join(', ')}`);
  logger.info(`Build features: ${report.capabilities.buildFeatures.join(', ')}`);
}
