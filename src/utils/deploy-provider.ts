import type { DeployProvider } from '../core/config.js';

export const DEFAULT_DEPLOY_PROVIDER: DeployProvider = 'vercel';

export function getPlatformCommand(command: string, platform = process.platform): string {
  return platform === 'win32' ? `${command}.cmd` : command;
}

export function getVercelCommand(platform = process.platform): string {
  return getPlatformCommand('vercel', platform);
}

export function getNpxCommand(platform = process.platform): string {
  return getPlatformCommand('npx', platform);
}

export function getDeployProviderName(provider: DeployProvider): string {
  return provider === 'netlify' ? 'Netlify' : 'Vercel';
}

export function normalizeDeployProvider(provider?: string | null): DeployProvider | undefined {
  const normalized = provider?.trim().toLowerCase();
  if (normalized === 'vercel' || normalized === 'netlify') {
    return normalized;
  }

  return undefined;
}

export function resolveDeployProvider(provider?: string | null, fallback = DEFAULT_DEPLOY_PROVIDER): DeployProvider {
  if (!provider) {
    return fallback;
  }

  const normalized = normalizeDeployProvider(provider);
  if (!normalized) {
    throw new Error(`Unsupported deploy provider: ${provider}. Expected one of: vercel, netlify.`);
  }

  return normalized;
}
