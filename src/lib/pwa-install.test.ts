import { describe, expect, it } from 'vitest';
import { getPwaInstallPromptState } from './pwa-install';

describe('getPwaInstallPromptState', () => {
  it('shows manual Add to Home Screen instructions on iOS', () => {
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
    expect(result.message).toContain('Add to Home Screen');
  });

  it('does not show an install prompt on Android unless the browser provides one', () => {
    const result = getPwaInstallPromptState({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile',
      isStandalone: false,
      isInstalled: false,
      hasDeferredPrompt: false,
    });

    expect(result.shouldPrompt).toBe(false);
  });

  it('shows an actionable Install prompt when the browser provides one', () => {
    const result = getPwaInstallPromptState({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile',
      isStandalone: false,
      isInstalled: false,
      hasDeferredPrompt: true,
    });

    expect(result.shouldPrompt).toBe(true);
    expect(result.actionLabel).toBe('Install');
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
