import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/main.scss';

// StrictMode double-invokes render and mounts effects twice in development (never in production) to surface impure
// renders and missing effect cleanups. See docs/react-concepts/06-useeffect-and-lifecycle.md.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
