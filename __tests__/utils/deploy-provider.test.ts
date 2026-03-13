import { describe, expect, it } from 'vitest';

import {
  getDeployProviderName,
  getNpxCommand,
  getPlatformCommand,
  getVercelCommand,
  normalizeDeployProvider,
  resolveDeployProvider,
} from '../../src/utils/deploy-provider.js';

describe('deploy provider utils', () => {
  it('returns Windows command wrappers on win32', () => {
    expect(getPlatformCommand('vercel', 'win32')).toBe('vercel.cmd');
    expect(getVercelCommand('win32')).toBe('vercel.cmd');
    expect(getNpxCommand('win32')).toBe('npx.cmd');
  });

  it('returns bare commands on non-Windows platforms', () => {
    expect(getPlatformCommand('vercel', 'linux')).toBe('vercel');
    expect(getVercelCommand('linux')).toBe('vercel');
    expect(getNpxCommand('linux')).toBe('npx');
  });

  it('normalizes known providers', () => {
    expect(normalizeDeployProvider('Netlify')).toBe('netlify');
    expect(normalizeDeployProvider(' VERCEL ')).toBe('vercel');
  });

  it('returns a fallback provider when none is given', () => {
    expect(resolveDeployProvider()).toBe('vercel');
    expect(resolveDeployProvider(undefined, 'netlify')).toBe('netlify');
  });

  it('throws on unknown providers', () => {
    expect(() => resolveDeployProvider('render')).toThrow('Unsupported deploy provider: render.');
  });

  it('returns human-friendly provider names', () => {
    expect(getDeployProviderName('vercel')).toBe('Vercel');
    expect(getDeployProviderName('netlify')).toBe('Netlify');
  });
});
