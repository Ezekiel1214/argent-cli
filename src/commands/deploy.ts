import { execa } from 'execa';
import { confirmDeploy } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';
import { loadConfig, type DeployProvider } from '../core/config.js';
import { getDeployProviderName, getNpxCommand, getVercelCommand, resolveDeployProvider } from '../utils/deploy-provider.js';

export interface DeployOptions {
  provider?: DeployProvider | string;
  skipPrompt?: boolean;
}

async function ensureDeployCli(provider: DeployProvider): Promise<boolean> {
  try {
    if (provider === 'netlify') {
      await execa(getNpxCommand(), ['netlify', '--version']);
    } else {
      await execa(getVercelCommand(), ['--version']);
    }
    return true;
  } catch {
    logger.error(
      provider === 'netlify'
        ? 'Netlify CLI not available. Try `npx netlify --version` or install it globally: npm i -g netlify-cli'
        : 'Vercel CLI not found. Please install it: npm i -g vercel',
    );
    return false;
  }
}

async function runDeploy(provider: DeployProvider): Promise<void> {
  if (provider === 'netlify') {
    await execa(getNpxCommand(), ['netlify', 'deploy', '--prod'], { stdio: 'inherit' });
    return;
  }

  await execa(getVercelCommand(), ['--prod'], { stdio: 'inherit' });
}

export async function deploy(options: DeployOptions | boolean = {}): Promise<void> {
  const normalizedOptions = typeof options === 'boolean' ? { skipPrompt: options } : options;
  const config = await loadConfig();
  const configProvider = typeof config.deployProvider === 'string' ? config.deployProvider : undefined;

  let provider: DeployProvider;
  try {
    provider = resolveDeployProvider(normalizedOptions.provider, resolveDeployProvider(configProvider));
  } catch (err) {
    logger.error((err as Error).message);
    return;
  }

  const providerName = getDeployProviderName(provider);
  const ok = normalizedOptions.skipPrompt || config.autoDeploy || (await confirmDeploy(providerName));
  if (!ok) {
    return;
  }

  const cliAvailable = await ensureDeployCli(provider);
  if (!cliAvailable) {
    return;
  }

  logger.info(`Deploying to ${providerName}...`);
  try {
    await runDeploy(provider);
    logger.success('Deployment complete!');
  } catch (err) {
    logger.error(`Deployment failed: ${String(err)}`);
  }
}
