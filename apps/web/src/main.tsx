import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReferenceFrontend } from './ReferenceFrontend.tsx';

// Avoid StrictMode double-invoking the one-time overlay capability exchange.
createRoot(document.getElementById('root')!).render(
  location.pathname.startsWith('/overlay/') ? (
    <ReferenceFrontend />
  ) : (
    <StrictMode>
      <ReferenceFrontend />
    </StrictMode>
  ),
);
