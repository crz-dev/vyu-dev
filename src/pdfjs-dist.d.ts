declare module "pdfjs-dist/build/pdf.mjs" {
  import pdfjsLib from "pdfjs-dist";
  export = pdfjsLib;
}

declare module "pdfjs-dist/build/pdf.worker.min.mjs" {
  export const WorkerMessageHandler: unknown;
}
