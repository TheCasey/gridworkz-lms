import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/product-direction',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: 'tmp/product-direction/browser-results',
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3107', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3107 --strictPort',
    url: 'http://127.0.0.1:3107', reuseExistingServer: false,
    env: {
      VITE_USE_FIREBASE_EMULATORS: 'true', VITE_FIREBASE_PROJECT_ID: 'demo-gridworkz-direction',
      VITE_FIREBASE_API_KEY: 'emulator-api-key', VITE_FIREBASE_APP_ID: 'emulator-app-id',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-gridworkz-direction.firebaseapp.com',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-gridworkz-direction.appspot.com',
    },
  },
});
