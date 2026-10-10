import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initSoundFeedback } from './lib/sound.ts';
import { initTips } from './lib/tip.ts';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

initTips();
initSoundFeedback();

const reveal = () =>
  requestAnimationFrame(() => document.documentElement.classList.add('ready'));
Promise.race([
  document.fonts.ready,
  new Promise((r) => setTimeout(r, 600)),
]).then(reveal);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
