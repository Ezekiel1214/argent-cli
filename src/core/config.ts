import { cosmiconfig } from 'cosmiconfig';

export type DeployProvider = 'vercel' | 'netlify';

export interface ArgentConfig {
  autoDeploy?: boolean;
  backupDir?: string;
  deployProvider?: DeployProvider;
}

const explorer = cosmiconfig('argent');

function formatConfigLabel(filePath?: string): string {
  return filePath ? filePath.replace(/\\/g, '/') : '.argentrc.json';
}

function validateConfig(config: unknown, filePath?: string): ArgentConfig {
  const label = formatConfigLabel(filePath);

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Invalid config in ${label}: expected a JSON object.`);
  }

  const typedConfig = config as Record<string, unknown>;

  if ('autoDeploy' in typedConfig && typeof typedConfig.autoDeploy !== 'boolean') {
    throw new Error(`Invalid config in ${label}: "autoDeploy" must be a boolean.`);
  }

  if ('backupDir' in typedConfig && typeof typedConfig.backupDir !== 'string') {
    throw new Error(`Invalid config in ${label}: "backupDir" must be a string.`);
  }

  if (
    'deployProvider' in typedConfig &&
    typedConfig.deployProvider !== undefined &&
    typedConfig.deployProvider !== 'vercel' &&
    typedConfig.deployProvider !== 'netlify'
  ) {
    throw new Error(`Invalid config in ${label}: "deployProvider" must be "vercel" or "netlify".`);
  }

  return typedConfig as ArgentConfig;
}

export async function loadConfig(): Promise<ArgentConfig> {
  const result = await explorer.search();
  if (!result) {
    return {};
  }

  return validateConfig(result.config, result.filepath);
}
