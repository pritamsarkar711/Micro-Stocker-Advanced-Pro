import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android shell for the same web app.
 *
 * The bundle is built by Vite with a relative base, which is what both Electron
 * and Capacitor need, so the phone runs the exact same code as the desktop and
 * the browser. Accounts, subscriptions and credits come from the same backend.
 */
const config: CapacitorConfig = {
  appId: 'com.microstocker.advancedpro',
  appName: 'vecmotion',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#101114',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
