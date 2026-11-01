import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import FinalFrontend from './final/App.tsx';
import { PublicChronicle } from './final/PublicChronicle.tsx';

// Avoid StrictMode double-invoking the one-time overlay capability exchange.
createRoot(document.getElementById('root')!).render(
  location.pathname.startsWith('/overlay/') ? (
    <FinalFrontend />
  ) : location.pathname.startsWith('/chronicle') ? (
    <StrictMode>
      <PublicChronicle />
    </StrictMode>
  ) : (
    <StrictMode>
      <FinalFrontend />
    </StrictMode>
  ),
);
