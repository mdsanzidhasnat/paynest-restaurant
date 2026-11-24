export function logStage(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

export function logWarn(message: string): void {
  console.warn(`[${new Date().toISOString()}] WARNING: ${message}`);
}

export function logError(message: string, error?: unknown): void {
  const detail =
    error instanceof Error
      ? error.stack ?? error.message
      : error === undefined
        ? ''
        : String(error);
  console.error(`[${new Date().toISOString()}] ${message}${detail ? `\n${detail}` : ''}`);
}
