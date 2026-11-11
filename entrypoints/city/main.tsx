import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useAppStore, attachStoreSync } from '@/store';
import './style.css';

// The page is its own JS realm like the popup: its store hydrates once and then
// follows what the background writes, so the city grows here while it grows in
// the popup. `useAppStore` is read-only, so the page can never write (§1.3).
attachStoreSync(useAppStore);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('City page root element #root not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
