import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mazerunner.godot3d',
  appName: 'Maze Runner 3D',
  webDir: 'dist',
  server: {
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    backgroundColor: '#060b1a',
  },
};

export default config;
