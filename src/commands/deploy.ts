import { execa } from 'execa';
import { confirmDeploy } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../core/config.js';

export async function deploy(skipPrompt = false): Promise<void> {
  try {
    await execa('vercel', ['--version']);
  } catch {
    logger.error('Vercel CLI not found. Please install it: npm i -g vercel');
    return;
  }

  const config = await loadConfig();
  const ok = skipPrompt || config.autoDeploy || (await confirmDeploy());
  if (!ok) {
    return;
  }

  logger.info('Deploying to Vercel...');
  try {
    await execa('vercel', ['--prod'], { stdio: 'inherit' });
    logger.success('Deployment complete!');
  } catch (err) {
    logger.error(`Deployment failed: ${String(err)}`);
  }
}
