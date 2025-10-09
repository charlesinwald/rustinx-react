declare module '*.png';

interface Window {
  __TAURI_IPC__?: (message: any) => Promise<any>;
}
