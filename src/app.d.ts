export {};

declare global {
  const __APP_VERSION__: string;
  interface Window {
    __INITIAL_FILE__?: string;
  }
}
