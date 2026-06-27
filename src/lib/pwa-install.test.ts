import { describe, expect, it } from 'vitest';
import { getPwaInstallPromptState } from './pwa-install';

describe('getPwaInstallPromptState', () => {
  it('prompts mobile users to install when the app is not installed', () => {
    const result = getPwaInstallPromptState({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      isStandalone: false,
      isInstalled: false,
      hasDeferredPrompt: false,
    });

    expect(result.shouldPrompt).toBe(true);
    expect(result.isMobile).toBe(true);
    expect(result.isIOS).toBe(true);
    expect(result.title).toContain('Install');
    expect(result.message).toContain('home screen');
  });

  it('does not prompt when the app is already installed', () => {
    const result = getPwaInstallPromptState({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      isStandalone: true,
      isInstalled: true,
      hasDeferredPrompt: false,
    });

    expect(result.shouldPrompt).toBe(false);
  });
});
