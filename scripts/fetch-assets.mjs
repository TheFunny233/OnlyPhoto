import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const dir = path.join(process.cwd(), 'public', 'demo');
fs.mkdirSync(dir, { recursive: true });

const items = [
  'hero',
  'city-skyline',
  'street-portrait',
  'lake-reflection',
  'old-town-bridge',
  'night-market',
  'coast-boardwalk',
  'city-observation',
  'mountain-mist',
];

const sources = [];

for (const name of items) {
  const file = path.join(dir, `${name}.jpg`);
  if (fs.existsSync(file)) {
    sources.push({ name, status: 'existing' });
    console.log(name, 'existing');
    continue;
  }
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt += 1) {
    try {
      const res = await fetch(`https://picsum.photos/seed/photomaster-${name}/1280/854`, {
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const out = await sharp(buf).resize(1200, 800, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
        fs.writeFileSync(file, out);
        ok = true;
      }
    } catch {
      // retry
    }
  }
  if (!ok) {
    const out = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: { r: 232, g: 232, b: 235 } },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
    fs.writeFileSync(file, out);
  }
  sources.push({ name, status: ok ? 'downloaded' : 'generated' });
  console.log(name, ok ? 'downloaded' : 'generated');
}

fs.mkdirSync(path.join(process.cwd(), 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), 'artifacts', 'assets.json'), JSON.stringify(sources, null, 2));
console.log('done');