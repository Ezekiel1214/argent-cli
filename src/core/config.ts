import { cosmiconfig } from 'cosmiconfig';

export type DeployProvider = 'vercel' | 'netlify';

export interface ArgentConfig {
  autoDeploy?: boolean;
  backupDir?: string;
  deployProvider?: DeployProvider;
}

const explorer = cosmiconfig('argent');

export async function loadConfig(): Promise<ArgentConfig> {
  try {
    const result = await explorer.search();
    return (result?.config as ArgentConfig) ?? {};
  } catch {
    return {};
  }
}
