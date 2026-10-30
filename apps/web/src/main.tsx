import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import FinalFrontend from './final/App.tsx';

// Avoid StrictMode double-invoking the one-time overlay capability exchange.
createRoot(document.getElementById('root')!).render(
  location.pathname.startsWith('/overlay/') ? (
    <FinalFrontend />
  ) : (
    <StrictMode>
      <FinalFrontend />
    </StrictMode>
  ),
);
