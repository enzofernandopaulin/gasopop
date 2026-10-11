import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gasopop.app',
  appName: 'GasoPop',
  webDir: '.output/public',
  server: {
    androidScheme: 'https',
  },
};

export default config;
