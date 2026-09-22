import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fcarena.vs',
  appName: 'FC Arena VS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
