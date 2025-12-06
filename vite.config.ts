import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Use process.cwd() safely by treating process as any to avoid strict type checks on 'cwd'
  const cwd = (process as any).cwd ? (process as any).cwd() : '.';
  const env = loadEnv(mode, cwd, '');
  
  return {
    plugins: [react()],
    define: {
      // Safely pass the API Key. If it's missing, it defaults to an empty string.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    }
  };
});