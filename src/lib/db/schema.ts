import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';

const ms = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    nickname: text('nickname').notNull(),
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [index('users_email_idx').on(t.email)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: ms('created_at').notNull(),
    expiresAt: ms('expires_at').notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),
    contentHash: text('content_hash').notNull(),
    privacy: text('privacy').notNull().default('private'), // private | public
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [
    index('photos_owner_idx').on(t.ownerId),
    index('photos_hash_idx').on(t.ownerId, t.contentHash),
  ],
);

export const analysisJobs = sqliteTable(
  'analysis_jobs',
  {
    id: text('id').primaryKey(),
    photoId: text('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('queued'), // queued|processing|succeeded|failed|canceled
    error: text('error'),
    errorType: text('error_type'),
    idempotencyKey: text('idempotency_key').notNull(),
    mode: text('mode').notNull(), // live | mock
    provider: text('provider').notNull().default(''),
    model: text('model'),
    promptVersion: text('prompt_version').notNull(),
    scene: text('scene').notNull().default(''),
    goals: text('goals').notNull().default('[]'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: ms('created_at').notNull(),
    startedAt: ms('started_at'),
    finishedAt: ms('finished_at'),
  },
  (t) => [
    uniqueIndex('analysis_idem_idx').on(t.idempotencyKey),
    index('analysis_photo_idx').on(t.photoId),
    index('analysis_status_idx').on(t.status),
  ],
);

export const analysisResults = sqliteTable(
  'analysis_results',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => analysisJobs.id, { onDelete: 'cascade' }),
    photoId: text('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    data: text('data').notNull(), // validated PhotoAnalysis JSON
    receipt: text('receipt').notNull(), // server-created AnalysisReceipt JSON
    createdAt: ms('created_at').notNull(),
  },
  (t) => [uniqueIndex('analysis_result_job_idx').on(t.jobId)],
);

export const editRecipes = sqliteTable(
  'edit_recipes',
  {
    id: text('id').primaryKey(),
    photoId: text('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipe: text('recipe').notNull(), // EditRecipe JSON
    updatedAt: ms('updated_at').notNull(),
  },
  (t) => [uniqueIndex('recipe_photo_idx').on(t.photoId)],
);

export const spots = sqliteTable(
  'spots',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    city: text('city').notNull().default(''),
    area: text('area').notNull().default(''),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    coordSystem: text('coord_system').notNull().default('WGS84'),
    precision: text('precision').notNull().default('approximate'), // exact | approximate
    subjects: text('subjects').notNull().default('[]'), // JSON array of strings
    description: text('description').notNull().default(''),
    howToStand: text('how_to_stand').notNull().default(''),
    direction: text('direction').notNull().default(''), // facing direction, '' = unknown
    bestLight: text('best_light').notNull().default(''),
    lightSource: text('light_source').notNull().default('unconfirmed'), // author_experience|external|unconfirmed
    gear: text('gear').notNull().default(''),
    safety: text('safety').notNull().default(''),
    status: text('status').notNull().default('published'), // draft | published | hidden
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
    verifiedAt: ms('verified_at'),
    createdAt: ms('created_at').notNull(),
    updatedAt: ms('updated_at').notNull(),
  },
  (t) => [index('spots_city_idx').on(t.city), index('spots_status_idx').on(t.status)],
);

export const spotMedia = sqliteTable(
  'spot_media',
  {
    id: text('id').primaryKey(),
    spotId: text('spot_id')
      .notNull()
      .references(() => spots.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    photoId: text('photo_id').references(() => photos.id, { onDelete: 'set null' }),
    storageKey: text('storage_key').notNull(), // public derivative path
    width: integer('width').notNull().default(0),
    height: integer('height').notNull().default(0),
    bytes: integer('bytes').notNull().default(0),
    sort: integer('sort').notNull().default(0),
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [index('spot_media_spot_idx').on(t.spotId)],
);

export const likes = sqliteTable(
  'likes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    spotId: text('spot_id')
      .notNull()
      .references(() => spots.id, { onDelete: 'cascade' }),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.spotId] })],
);

export const favorites = sqliteTable(
  'favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    spotId: text('spot_id')
      .notNull()
      .references(() => spots.id, { onDelete: 'cascade' }),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.spotId] })],
);

export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    spotId: text('spot_id')
      .notNull()
      .references(() => spots.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    status: text('status').notNull().default('visible'), // visible | hidden
    createdAt: ms('created_at').notNull(),
  },
  (t) => [index('comments_spot_idx').on(t.spotId)],
);

export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(), // spot | comment
    targetId: text('target_id').notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('open'), // open | resolved
    createdAt: ms('created_at').notNull(),
  },
  (t) => [index('reports_target_idx').on(t.targetType, t.targetId)],
);

export const apiUsage = sqliteTable(
  'api_usage',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    photoId: text('photo_id'),
    mode: text('mode').notNull(), // live | mock
    provider: text('provider').notNull().default(''),
    model: text('model'),
    status: text('status').notNull(), // success | error
    errorType: text('error_type'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    createdAt: ms('created_at').notNull(),
  },
  (t) => [index('api_usage_mode_idx').on(t.mode), index('api_usage_user_idx').on(t.userId)],
);

export const liveBudget = sqliteTable('live_budget', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull(),
  used: integer('used').notNull().default(0),
  limit: integer('limit').notNull().default(12),
  updatedAt: ms('updated_at').notNull(),
});

export const schema = {
  users,
  sessions,
  photos,
  analysisJobs,
  analysisResults,
  editRecipes,
  spots,
  spotMedia,
  likes,
  favorites,
  comments,
  reports,
  apiUsage,
  liveBudget,
};