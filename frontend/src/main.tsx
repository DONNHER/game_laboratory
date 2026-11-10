import {createRoot} from 'react-dom/client';
import { RealtimeProvider } from '@neon/realtime-react';
import App from './App.tsx';
import { neonRealtimeClient } from './services/neonRealtime';
import './index.css';

// Prevent recursive iframe loops if a static SPA host accidentally rewrites /godot/host.html -> /index.html
if (typeof window !== 'undefined' && /\/godot\/host\.html$/i.test(window.location.pathname)) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(
      {
        source: 'maze_runner_godot',
        seq: 1,
        payload: {
          type: 'boot_error',
          message:
            'Static server rewrote /godot/host.html to index.html. Ensure frontend/public/godot is served statically or run "pnpm run dev".',
        },
      },
      '*'
    );
  }
} else {
  const root = createRoot(document.getElementById('root')!);
  root.render(
    neonRealtimeClient ? (
      <RealtimeProvider client={neonRealtimeClient}>
        <App />
      </RealtimeProvider>
    ) : (
      <App />
    )
  );
}
