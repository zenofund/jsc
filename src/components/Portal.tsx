import React from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
}

export function Portal({ children }: PortalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const portalRoot =
    document.getElementById('portal-root') ||
    (() => {
      const div = document.createElement('div');
      div.setAttribute('id', 'portal-root');
      document.body.appendChild(div);
      return div;
    })();

  return createPortal(children, portalRoot);
}
