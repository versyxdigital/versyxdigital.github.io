import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

if (import.meta.env.DEV) {
  // Console handle for tuning the field while developing.
  void Promise.all([import('./field/fieldState'), import('./state/store'), import('./system/scroll')]).then(
    ([fieldState, store, scrollModule]) => {
      Object.assign(window, { __system: { ...fieldState, store: store.useSystem, scroll: scrollModule.scroll } });
    },
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
