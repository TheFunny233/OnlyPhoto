import { desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { listPhotos } from './photos';

export function getMeSummary(userId: string) {
  const photos = listPhotos(userId);

  const mySpots = db
    .select()
    .from(schema.spots)
    .where(eq(schema.spots.ownerId, userId))
    .orderBy(desc(schema.spots.createdAt))
    .all();

  const favoriteRows = db
    .select()
    .from(schema.favorites)
    .where(eq(schema.favorites.userId, userId))
    .orderBy(desc(schema.favorites.createdAt))
    .all();

  const favoriteSpotIds = favoriteRows.map((r) => r.spotId);
  const favoriteSpots =
    favoriteSpotIds.length > 0
      ? db.select().from(schema.spots).where(inArray(schema.spots.id, favoriteSpotIds)).all()
      : [];

  const recipes = db
    .select()
    .from(schema.editRecipes)
    .where(eq(schema.editRecipes.ownerId, userId))
    .orderBy(desc(schema.editRecipes.updatedAt))
    .all();

  return {
    counts: {
      photos: photos.length,
      analyses: photos.filter((p) => p.analysisStatus === 'succeeded').length,
      spots: mySpots.length,
      favorites: favoriteSpots.length,
      edits: recipes.length,
    },
    photos,
    spots: mySpots.map((s) => ({ id: s.id, title: s.title, city: s.city, status: s.status, createdAt: s.createdAt.toISOString() })),
    favoriteSpots: favoriteSpots.map((s) => ({ id: s.id, title: s.title, city: s.city, status: s.status })),
    recentEdits: recipes.map((r) => ({ photoId: r.photoId, updatedAt: r.updatedAt.toISOString(), recipe: JSON.parse(r.recipe) })),
  };
}