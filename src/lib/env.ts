function asBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function asInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function asStr(value: string | undefined, fallback: string): string {
  return value === undefined || value === '' ? fallback : value;
}

export const AI_PROMPT_VERSION = 'pm-analysis-v1';

export const env = {
  appName: asStr(process.env.APP_NAME, 'PhotoMaster'),
  appUrl: asStr(process.env.APP_URL, 'http://localhost:3000'),
  demoMode: asBool(process.env.APP_DEMO_MODE, true),
  databaseUrl: asStr(process.env.DATABASE_URL, 'file:./data/photomaster.db'),
  uploadDir: asStr(process.env.UPLOAD_DIR, './data/uploads'),
  sessionSecret: process.env.SESSION_SECRET ?? '',
  registrationOpen: asBool(process.env.REGISTRATION_OPEN, true),
  maintenanceToken: process.env.MAINTENANCE_TOKEN ?? '',

  ai: {
    mode: process.env.AI_MODE === 'live' ? ('live' as const) : ('mock' as const),
    protocol: asStr(process.env.AI_PROTOCOL, 'chat_completions'),
    baseUrl: process.env.AI_BASE_URL ?? '',
    apiKey: process.env.AI_API_KEY ?? '',
    visionModel: process.env.AI_VISION_MODEL ?? '',
    requestTimeoutMs: asInt(process.env.AI_REQUEST_TIMEOUT_MS, 45_000),
    maxOutputTokens: asInt(process.env.AI_MAX_OUTPUT_TOKENS, 1800),
    maxRetries: asInt(process.env.AI_MAX_RETRIES, 1),
    maxImageEdge: asInt(process.env.AI_MAX_IMAGE_EDGE, 1600),
    maxImageBytes: asInt(process.env.AI_MAX_IMAGE_BYTES, 3_000_000),
    userDailyRequestLimit: asInt(process.env.AI_USER_DAILY_REQUEST_LIMIT, 10),
    disableThinking: asBool(process.env.AI_DISABLE_THINKING, false),
  },

  liveTests: {
    run: asBool(process.env.RUN_LIVE_AI_TESTS, false),
    maxRequests: asInt(process.env.LIVE_TEST_MAX_REQUESTS, 12),
  },

  map: {
    tileUrl: asStr(
      process.env.NEXT_PUBLIC_MAP_TILE_URL,
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ),
    attribution: asStr(process.env.NEXT_PUBLIC_MAP_ATTRIBUTION, 'OpenStreetMap contributors'),
    copyrightUrl: 'https://www.openstreetmap.org/copyright',
  },

  upload: {
    maxBytes: 15 * 1024 * 1024,
    maxPixels: 40_000_000,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'] as const,
  },
} as const;

export type AppEnv = typeof env;

export const isAiLiveConfigured = (): boolean =>
  env.ai.mode === 'live' && env.ai.baseUrl.length > 0 && env.ai.apiKey.length > 0 && env.ai.visionModel.length > 0;