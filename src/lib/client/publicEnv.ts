export const env = {
  mapTileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || 'OpenStreetMap contributors',
};