export const SUBJECT_OPTIONS = [
  '人像',
  '风景',
  '建筑',
  '街拍',
  '美食',
  '日出日落',
  '夜景',
  '人文',
] as const;

export const LIGHT_SOURCE_LABEL: Record<string, string> = {
  author_experience: '作者经验',
  external: '外部资料',
  unconfirmed: '尚未确认',
};

export const PRECISION_LABEL: Record<string, string> = {
  exact: '精确位置',
  approximate: '大致位置',
};

export const APP_TAGLINE = '看懂这张照片，拍好下一张。';