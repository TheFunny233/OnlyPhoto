// Side-effect module: load local env files for standalone scripts (Next loads them itself).
for (const file of ['.env.local', '.env']) {
  try {
    // Node >= 21.7 provides process.loadEnvFile
    (process as unknown as { loadEnvFile: (path?: string) => void }).loadEnvFile(file);
  } catch {
    // file missing or unsupported; fall back to process env
  }
}