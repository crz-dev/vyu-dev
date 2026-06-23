// Global type declarations
export {};

declare global {
  const __APP_VERSION__: string;
  interface Window {
    __INITIAL_FILE__?: string;
  }
  // PDF.js fake-worker support — set when a PDF is opened
  // eslint-disable-next-line no-var
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}
