import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { useAppStore, attachStoreSync } from '@/store';
import './style.css';

// The popup is a separate JS realm from the background service worker, so its
// store starts from a one-time hydration. Keep it converged on writes made by
// the background (e.g. a timer tick) while the popup stays open (M1.T8).
attachStoreSync(useAppStore);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Popup root element #root not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
