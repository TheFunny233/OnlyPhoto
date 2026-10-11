export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runMigrations } = await import('./lib/db/migrate');
    try {
      runMigrations();
    } catch (error) {
      console.error('[photomaster] database migration failed:', (error as Error).message);
      throw error;
    }
  }
}