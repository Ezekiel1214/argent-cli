import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';
import { loadConfig } from '../core/config.js';
import { logger } from '../utils/logger.js';
import {
  DEFAULT_DEPLOY_PROVIDER,
  getDeployProviderName,
  getNpxCommand,
  getVercelCommand,
  normalizeDeployProvider,
} from '../utils/deploy-provider.js';

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
    deployProvider: string;
  };
  files: {
    defaultMappingExists: boolean;
    configExists: boolean;
  };
  integrations: {
    deployCliAvailable: boolean;
    deployCliName: string;
    deployCliVersion?: string;
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

async function getDeployStatus(provider: 'vercel' | 'netlify'): Promise<{ available: boolean; version?: string }> {
  const command = provider === 'netlify' ? getNpxCommand() : getVercelCommand();
  const args = provider === 'netlify' ? ['netlify', '--version'] : ['--version'];

  try {
    const result = await execa(command, args);
    return {
      available: true,
      version: result.stdout.trim() || undefined,
    };
  } catch {
    return { available: false };
  }
}

export async function doctor(options: DoctorOptions = {}): Promise<void> {
  try {
    const config = await loadConfig();
    const deployProvider =
      normalizeDeployProvider(typeof config.deployProvider === 'string' ? config.deployProvider : undefined) ??
      DEFAULT_DEPLOY_PROVIDER;
    const deployStatus = await getDeployStatus(deployProvider);
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
        deployProvider,
      },
      files: {
        defaultMappingExists: await fileExists(path.join('.argent', 'mapping.json')),
        configExists: await fileExists('.argentrc.json'),
      },
      integrations: {
        deployCliAvailable: deployStatus.available,
        deployCliName: getDeployProviderName(deployProvider),
        deployCliVersion: deployStatus.version,
      },
      capabilities: {
        captureInputs: ['clipboard', 'stdin', 'file'],
        captureFeatures: ['plain-document fallback', 'heading splitting', 'default file', 'path inference', 'custom mapping output'],
        applyFeatures: ['single-file apply', 'custom mapping input', 'dry-run', 'require-changes', 'deploy', 'deploy provider selection'],
        buildFeatures: ['ingest-and-build', 'path inference', 'split headings', 'optional deploy', 'deploy provider selection'],
      },
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    logger.info(`argent ${report.version}`);
    logger.info(`Node ${report.runtime.node} on ${report.runtime.platform}`);
    logger.info(`Working directory: ${report.runtime.cwd}`);
    logger.info(
      `Config: autoDeploy=${report.config.autoDeploy} backupDir=${report.config.backupDir} deployProvider=${report.config.deployProvider}`,
    );
    logger.info(`Files: config=${report.files.configExists ? 'present' : 'missing'} mapping=${report.files.defaultMappingExists ? 'present' : 'missing'}`);
    logger.info(
      `${report.integrations.deployCliName} CLI: ${
        report.integrations.deployCliAvailable
          ? `available${report.integrations.deployCliVersion ? ` (${report.integrations.deployCliVersion})` : ''}`
          : 'missing'
      }`,
    );
    logger.info(`Capture inputs: ${report.capabilities.captureInputs.join(', ')}`);
    logger.info(`Capture features: ${report.capabilities.captureFeatures.join(', ')}`);
    logger.info(`Apply features: ${report.capabilities.applyFeatures.join(', ')}`);
    logger.info(`Build features: ${report.capabilities.buildFeatures.join(', ')}`);
  } catch (err: unknown) {
    logger.error((err as Error).message);
  }
}
