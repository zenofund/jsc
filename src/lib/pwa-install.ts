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

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export interface PwaInstallManagerState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
}

let managerState: PwaInstallManagerState = {
  deferredPrompt: null,
  isInstalled: false,
};
let managerInitialized = false;
const managerListeners = new Set<(state: PwaInstallManagerState) => void>();

function notifyPwaInstallManager() {
  managerListeners.forEach((listener) => listener(managerState));
}

export function initializePwaInstallManager() {
  if (managerInitialized || typeof window === 'undefined') return;
  managerInitialized = true;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  managerState = {
    deferredPrompt: null,
    isInstalled: isStandalone,
  };

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    managerState = { ...managerState, deferredPrompt: event as BeforeInstallPromptEvent };
    notifyPwaInstallManager();
  });

  window.addEventListener('appinstalled', () => {
    managerState = { deferredPrompt: null, isInstalled: true };
    notifyPwaInstallManager();
  });
}

export function getPwaInstallManagerState() {
  return managerState;
}

export function subscribeToPwaInstallManager(listener: (state: PwaInstallManagerState) => void) {
  managerListeners.add(listener);
  return () => managerListeners.delete(listener);
}

export function clearPwaInstallPrompt() {
  if (!managerState.deferredPrompt) return;
  managerState = { ...managerState, deferredPrompt: null };
  notifyPwaInstallManager();
}

export function markPwaInstalled() {
  managerState = { deferredPrompt: null, isInstalled: true };
  notifyPwaInstallManager();
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
  const shouldPrompt = !isInstalled && !isStandalone && (hasDeferredPrompt || isIOS);

  if (!shouldPrompt) {
    return {
      shouldPrompt: false,
      isMobile,
      isIOS,
      isAndroid,
      title: 'Install JSC PMS',
      message: 'Install this app for a faster, app-like experience.',
      actionLabel: hasDeferredPrompt ? 'Install' : 'Got it',
    };
  }

  if (isIOS) {
    return {
      shouldPrompt: true,
      isMobile: true,
      isIOS: true,
      isAndroid: false,
      title: 'Install JSC PMS on your iPhone',
      message: hasDeferredPrompt
        ? 'Tap Install to open your browser’s installation prompt.'
        : 'To install, tap Share in Safari and choose Add to Home Screen.',
      actionLabel: hasDeferredPrompt ? 'Install' : 'Got it',
    };
  }

  if (isAndroid) {
    return {
      shouldPrompt: true,
      isMobile: true,
      isIOS: false,
      isAndroid: true,
      title: 'Install JSC PMS on your phone',
      message: 'Tap Install to open your browser’s installation prompt.',
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
    actionLabel: hasDeferredPrompt ? 'Install' : 'Got it',
  };
}
