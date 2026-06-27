import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silencia erros e rejeições benignos do WebSocket do Vite provocados pelo proxy do ambiente
if (typeof window !== 'undefined') {
  const isViteError = (err: any) => {
    if (!err) return false;
    const msg = String(err.message || err);
    return msg.toLowerCase().includes('websocket') || msg.toLowerCase().includes('vite');
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isViteError(event.reason)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (isViteError(event.error) || isViteError(event.message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
