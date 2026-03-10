import { cosmiconfig } from 'cosmiconfig';

export interface ArgentConfig {
  autoDeploy?: boolean;
  backupDir?: string;
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
