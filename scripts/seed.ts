import '../src/lib/loadEnv';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/lib/db/client';
import { resolveUploadDir } from '../src/lib/db/client';
import { hashPassword } from '../src/lib/auth/password';
import { runMigrations } from '../src/lib/db/migrate';
import { env } from '../src/lib/env';

runMigrations();

const DEMO_USERS = [
  { id: 'demo-user-a', email: 'demo.a@onlyphoto.local', nickname: '演示用户 A', password: 'demo12345' },
  { id: 'demo-user-b', email: 'demo.b@onlyphoto.local', nickname: '演示用户 B', password: 'demo12345' },
];

type DemoSpot = {
  id: string;
  title: string;
  city: string;
  area: string;
  lat: number;
  lng: number;
  precision: 'exact' | 'approximate';
  subjects: string[];
  description: string;
  howToStand: string;
  direction: string;
  bestLight: string;
  lightSource: 'author_experience' | 'external' | 'unconfirmed';
  gear: string;
  safety: string;
  image: string;
};

const DEMO_SPOTS: DemoSpot[] = [
  {
    id: 'demo-spot-1',
    title: '外滩亲水平台·对岸天际线',
    city: '上海',
    area: '黄浦区·外滩',
    lat: 31.2401,
    lng: 121.4902,
    precision: 'approximate',
    subjects: ['建筑', '夜景', '日出日落'],
    description: '演示机位：以对岸天际线为主体，适合练习地平线与主体取舍。',
    howToStand: '站在亲水平台靠护栏一侧，面向对岸；稍微向左移动，让路灯避开主体轮廓。',
    direction: '朝东北',
    bestLight: '傍晚蓝调时段（作者经验，具体时段未核实）',
    lightSource: 'author_experience',
    gear: '等效 24-35mm',
    safety: '公共区域，注意人流与护栏，不要翻越围栏。',
    image: 'city-skyline.jpg',
  },
  {
    id: 'demo-spot-2',
    title: '老街骑楼·雨后人像',
    city: '广州',
    area: '荔湾区·老街',
    lat: 23.1168,
    lng: 113.2397,
    precision: 'approximate',
    subjects: ['人像', '街拍', '人文'],
    description: '演示机位：利用骑楼顶棚的柔光拍摄人像，注意背景招牌不要压过人物。',
    howToStand: '让被摄者站在骑楼下避光处，拍摄者后退两步，用招牌作为背景但避免与头部重叠。',
    direction: '朝向骑楼内侧',
    bestLight: '阴天或雨后（外部资料，尚未核实）',
    lightSource: 'external',
    gear: '',
    safety: '尊重商户与居民，拍摄前先征求同意。',
    image: 'street-portrait.jpg',
  },
  {
    id: 'demo-spot-3',
    title: '城市公园湖畔·倒影构图',
    city: '杭州',
    area: '西湖区·湖畔',
    lat: 30.2465,
    lng: 120.1492,
    precision: 'approximate',
    subjects: ['风景', '日出日落'],
    description: '演示机位：贴近水面拍摄倒影，利用对称构图强化层次。',
    howToStand: '站在湖边安全区域，蹲低让镜头贴近水面，保持地平线水平。',
    direction: '朝西',
    bestLight: '清晨（条件性建议）',
    lightSource: 'author_experience',
    gear: '',
    safety: '注意水边安全，不要越过警示线。',
    image: 'lake-reflection.jpg',
  },
  {
    id: 'demo-spot-4',
    title: '古镇石桥·晨雾',
    city: '苏州',
    area: '平江路一带',
    lat: 31.3135,
    lng: 120.6298,
    precision: 'approximate',
    subjects: ['风景', '人文'],
    description: '演示机位：以石桥为前景，等待行人经过形成对比。',
    howToStand: '站在桥的一端，沿河道方向拍摄，让桥拱框住远景。',
    direction: '沿河道逆光方向',
    bestLight: '清晨薄雾（未核实）',
    lightSource: 'unconfirmed',
    gear: '',
    safety: '桥面狭窄，注意来往行人。',
    image: 'old-town-bridge.jpg',
  },
  {
    id: 'demo-spot-5',
    title: '夜市小吃摊·美食特写',
    city: '成都',
    area: '锦江区·夜市',
    lat: 30.6571,
    lng: 104.0816,
    precision: 'approximate',
    subjects: ['美食', '街拍'],
    description: '演示机位：用摊位灯光作为主光源拍摄食物特写。',
    howToStand: '从摊位侧前方拍摄，让暖光从侧上方向下，避免自己的阴影挡住食物。',
    direction: '侧前方',
    bestLight: '夜间摊位灯光（作者经验）',
    lightSource: 'author_experience',
    gear: '',
    safety: '注意烟火与热油，先征得摊主同意。',
    image: 'night-market.jpg',
  },
  {
    id: 'demo-spot-6',
    title: '海湾栈道·长曝海景',
    city: '厦门',
    area: '环岛路·栈道',
    lat: 24.4388,
    lng: 118.1089,
    precision: 'approximate',
    subjects: ['风景', '日出日落'],
    description: '演示机位：以栈道引导线指向海平面，适合练习水平线。',
    howToStand: '站在栈道起点，让栏杆形成引导线，保持地平线水平。',
    direction: '朝东南',
    bestLight: '日出前后（条件性建议）',
    lightSource: 'unconfirmed',
    gear: '三脚架有助于稳定',
    safety: '海风较大，注意脚下与设备安全。',
    image: 'coast-boardwalk.jpg',
  },
  {
    id: 'demo-spot-7',
    title: '高楼观景台·城市俯瞰',
    city: '重庆',
    area: '渝中区·观景平台',
    lat: 29.5630,
    lng: 106.5516,
    precision: 'approximate',
    subjects: ['建筑', '夜景'],
    description: '演示机位：透过观景台玻璃拍摄夜景，注意玻璃反光。',
    howToStand: '把镜头贴近玻璃，用手或衣角遮挡周围反光，避免拍到室内灯光倒影。',
    direction: '朝向江面',
    bestLight: '入夜后灯光亮起（作者经验）',
    lightSource: 'author_experience',
    gear: '',
    safety: '遵守观景台规定，不要攀爬护栏。',
    image: 'city-observation.jpg',
  },
  {
    id: 'demo-spot-8',
    title: '山间步道·云海远眺',
    city: '黄山',
    area: '风景区步道',
    lat: 30.1319,
    lng: 118.1669,
    precision: 'approximate',
    subjects: ['风景'],
    description: '演示机位：以近处松树为前景，拍摄远处云海层次。',
    howToStand: '站在步道内侧安全处，用前景枝条作为画框，避免遮挡远山主体。',
    direction: '朝向云海方向',
    bestLight: '清晨云海（未核实）',
    lightSource: 'unconfirmed',
    gear: '中长焦有助于压缩层次',
    safety: '山区天气多变，注意保暖与防滑，不进入未开放区域。',
    image: 'mountain-mist.jpg',
  },
];

function copyDemoImage(name: string): string | null {
  const src = path.join(process.cwd(), 'public', 'demo', name);
  if (!fs.existsSync(src)) return null;
  const targetKey = path.posix.join('public', 'demo', name);
  const targetAbs = path.join(resolveUploadDir(), targetKey);
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  fs.copyFileSync(src, targetAbs);
  return targetKey;
}

function seedUsers() {
  for (const u of DEMO_USERS) {
    const existing = db.select().from(schema.users).where(eq(schema.users.email, u.email)).get();
    if (!existing) {
      db.insert(schema.users)
        .values({
          id: u.id,
          email: u.email,
          nickname: u.nickname,
          passwordHash: hashPassword(u.password),
          isDemo: true,
          createdAt: new Date(),
        })
        .run();
      console.log(`[seed] created demo user ${u.email}`);
    }
  }
}

function seedSpots() {
  const owner = DEMO_USERS[0].id;
  for (const spot of DEMO_SPOTS) {
    const existing = db.select().from(schema.spots).where(eq(schema.spots.id, spot.id)).get();
    if (existing) continue;
    const now = new Date();
    db.insert(schema.spots)
      .values({
        id: spot.id,
        ownerId: owner,
        title: spot.title,
        city: spot.city,
        area: spot.area,
        lat: spot.lat,
        lng: spot.lng,
        coordSystem: 'WGS84',
        precision: spot.precision,
        subjects: JSON.stringify(spot.subjects),
        description: `${spot.description}（机位数据演示 / 配图非此地实拍）`,
        howToStand: spot.howToStand,
        direction: spot.direction,
        bestLight: spot.bestLight,
        lightSource: spot.lightSource,
        gear: spot.gear,
        safety: spot.safety,
        status: 'published',
        isDemo: true,
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const storageKey = copyDemoImage(spot.image);
    if (storageKey) {
      db.insert(schema.spotMedia)
        .values({
          id: randomUUID(),
          spotId: spot.id,
          ownerId: owner,
          photoId: null,
          storageKey,
          width: 1200,
          height: 800,
          bytes: fs.statSync(path.join(resolveUploadDir(), storageKey)).size,
          sort: 0,
          isDemo: true,
          createdAt: now,
        })
        .run();
    }
    console.log(`[seed] created demo spot ${spot.id}`);
  }
}

function seedInteractions() {
  const owner2 = DEMO_USERS[1].id;
  for (const spot of DEMO_SPOTS.slice(0, 3)) {
    const existingLike = db
      .select()
      .from(schema.likes)
      .where(eq(schema.likes.userId, owner2))
      .all()
      .some((l) => l.spotId === spot.id);
    if (!existingLike) {
      db.insert(schema.likes).values({ userId: owner2, spotId: spot.id, createdAt: new Date() }).onConflictDoNothing().run();
    }
    const hasComment = db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.spotId, spot.id))
      .all()
      .length > 0;
    if (!hasComment) {
      db.insert(schema.comments)
        .values({
          id: randomUUID(),
          spotId: spot.id,
          userId: owner2,
          body: '演示评论：这个角度不错，下次试试在蓝调时段来。',
          status: 'visible',
          createdAt: new Date(),
        })
        .run();
    }
  }
}

if (!env.demoMode) {
  console.log('[seed] APP_DEMO_MODE=false，跳过演示数据。');
} else {
  seedUsers();
  seedSpots();
  seedInteractions();
  console.log('[seed] 演示数据准备完成（幂等，可重复执行）。');
}