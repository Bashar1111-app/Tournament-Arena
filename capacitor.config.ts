import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sperkplay.fctournament',
  appName: 'FC Arena VS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '1056646427549-alg436s1bgkjagkpelpmsqc2l2upgq31.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;

