import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { AuthProvider } from './contexts/AuthContext';
import { registerAppServiceWorker } from './lib/pwa-service-worker';
import { initializePwaInstallManager } from './lib/pwa-install';

initializePwaInstallManager();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerAppServiceWorker().catch((error) => {
      console.error('Failed to register the app service worker:', error);
    });
  });
}
