export {};

declare global {
  const __APP_VERSION__: string;
  // PDF.js fake-worker support, set when a PDF is opened.
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}
