export interface PwaInstallPromptState {
  shouldPrompt: boolean;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  title: string;
  message: string;
  actionLabel: string;
}

export interface GetPwaInstallPromptStateInput {
  userAgent: string;
  isStandalone: boolean;
  isInstalled: boolean;
  hasDeferredPrompt: boolean;
}

export function getPwaInstallPromptState({
  userAgent,
  isStandalone,
  isInstalled,
  hasDeferredPrompt,
}: GetPwaInstallPromptStateInput): PwaInstallPromptState {
  const normalizedUserAgent = userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(normalizedUserAgent);
  const isIOS = /iphone|ipad|ipod/i.test(normalizedUserAgent);
  const isAndroid = /android/i.test(normalizedUserAgent);
  const shouldPrompt = !isInstalled && !isStandalone && (hasDeferredPrompt || isMobile);

  if (!shouldPrompt) {
    return {
      shouldPrompt: false,
      isMobile,
      isIOS,
      isAndroid,
      title: 'Install JSC PMS',
      message: 'Install this app for a faster, app-like experience.',
      actionLabel: 'Install',
    };
  }

  if (isIOS) {
    return {
      shouldPrompt: true,
      isMobile: true,
      isIOS: true,
      isAndroid: false,
      title: 'Install JSC PMS on your iPhone',
      message: 'Open the Share menu and choose Add to Home Screen to install this app on your home screen.',
      actionLabel: 'Install',
    };
  }

  if (isAndroid) {
    return {
      shouldPrompt: true,
      isMobile: true,
      isIOS: false,
      isAndroid: true,
      title: 'Install JSC PMS on your phone',
      message: 'Use the browser menu to install this app and keep quick access to payroll tools.',
      actionLabel: 'Install',
    };
  }

  return {
    shouldPrompt: true,
    isMobile,
    isIOS,
    isAndroid,
    title: 'Install JSC PMS',
    message: 'Install this app for a faster, app-like experience.',
    actionLabel: 'Install',
  };
}
