import { useState, useEffect } from 'react';

type NetworkStatus = 'Online' | 'Offline' | 'Slow';

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(navigator.onLine ? 'Online' : 'Offline');

  useEffect(() => {
    const handleOnline = () => setStatus('Online');
    const handleOffline = () => setStatus('Offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodically check latency if online
    const checkLatency = async () => {
      if (!navigator.onLine) return;

      const start = Date.now();
      try {
        // Use a lightweight fetch to check latency (e.g., app version or health check)
        // Using a timestamp to prevent caching
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}/health?t=${start}`, {
            method: 'HEAD', // HEAD request is lighter
            cache: 'no-store'
        });
        const end = Date.now();
        const latency = end - start;

        // Threshold for "Slow" connection (e.g., > 1500ms)
        if (latency > 1500) {
          setStatus('Slow');
        } else {
          setStatus('Online');
        }
      } catch (error) {
        // If fetch fails but navigator says online, it might be a server issue or really bad connection
        // We'll stick to 'Online' (as in connected to router) or 'Offline' if it fails completely
        // But if fetch fails, maybe we can consider it 'Offline' or keep 'Online' but maybe 'Unstable'
        // For simplicity, let's just respect navigator.onLine, but if we can't reach server, maybe 'Offline'?
        // The user requirement specifically asked for Online/Offline/Slow. 
        // If fetch fails, it effectively behaves like Offline for the app.
        // Let's keep it as is, relying on window events for basic connectivity.
      }
    };

    // Check latency every 10 seconds
    const intervalId = setInterval(checkLatency, 10000);
    // Initial check
    checkLatency();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, []);

  return status;
}
