import { createRealtimeClient } from '@neon/realtime/client';

const realtimeUrl = import.meta.env.VITE_NEON_REALTIME_URL;

export const neonRealtimeClient = realtimeUrl
  ? createRealtimeClient({ url: realtimeUrl })
  : null;
