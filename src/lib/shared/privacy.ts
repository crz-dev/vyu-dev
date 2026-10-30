const BULLETS = "••••••";

export function obscurePath(filePath: string): string {
  if (!filePath) return filePath;
  const sep = filePath.includes("\\") ? "\\" : "/";
  const parts = filePath.split(sep);
  if (parts.length <= 1) return filePath;
  return `${BULLETS}${sep}${parts[parts.length - 1]}`;
}

export function maskFileName(filePath: string): string {
  if (!filePath) return filePath;
  const name = filePath.split(/[/\\]/).pop() ?? filePath;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot) : "";
  return `${BULLETS}${ext}`;
}
