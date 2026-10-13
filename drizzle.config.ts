import { defineConfig } from 'drizzle-kit';

const url = (process.env.DATABASE_URL ?? 'file:./data/onlyphoto.db').replace(/^file:/, '');

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url,
  },
});