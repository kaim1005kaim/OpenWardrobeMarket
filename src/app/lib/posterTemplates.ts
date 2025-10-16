export interface PosterTemplate {
  id: string;
  framePath: string; // 透過フレームPNGのパス
  backgroundColor: string;
  frameSize: {
    // フレームPNG自体のサイズ
    width: number;
    height: number;
  };
  imageArea: {
    // ユーザー画像を配置するエリア（ピクセル値、フレームサイズ基準）
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const posterTemplatesBase: PosterTemplate[] = [
  {
    id: 'poster-a',
    framePath: '/poster/BG/poster_BG/a.png',
    backgroundColor: '#5B7DB1',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 100, y: 125, width: 600, height: 750 },
  },
  {
    id: 'poster-b',
    framePath: '/poster/BG/poster_BG/b.png',
    backgroundColor: '#E8B4B8',
    frameSize: { width: 800, height: 983 },
    imageArea: { x: 0, y: 100, width: 515, height: 883 },
  },
  {
    id: 'poster-c',
    framePath: '/poster/BG/poster_BG/c.png',
    backgroundColor: '#E8B4B8',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 145, y: 175, width: 520, height: 650 },
  },
  {
    id: 'poster-d',
    framePath: '/poster/BG/poster_BG/d.png',
    backgroundColor: '#FF8C42',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 250, y: 305, width: 355, height: 445 },
  },
  {
    id: 'poster-e',
    framePath: '/poster/BG/poster_BG/e.png',
    backgroundColor: '#C1403D',
    frameSize: { width: 800, height: 1076 },
    imageArea: { x: 170, y: 245, width: 465, height: 585 },
  },
  {
    id: 'poster-f',
    framePath: '/poster/BG/poster_BG/f.png',
    backgroundColor: '#F4C542',
    frameSize: { width: 800, height: 1076 },
    imageArea: { x: 170, y: 180, width: 465, height: 585 },
  },
  {
    id: 'poster-g',
    framePath: '/poster/BG/poster_BG/g.png',
    backgroundColor: '#9B6B9E',
    frameSize: { width: 800, height: 1188 },
    imageArea: { x: 155, y: 260, width: 490, height: 615 },
  },
  {
    id: 'poster-h',
    framePath: '/poster/BG/poster_BG/h.png',
    backgroundColor: '#5B9AA8',
    frameSize: { width: 800, height: 1376 },
    imageArea: { x: 118, y: 342, width: 572, height: 688 },
  },
  {
    id: 'poster-i',
    framePath: '/poster/BG/poster_BG/i.png',
    backgroundColor: '#C1403D',
    frameSize: { width: 800, height: 1376 },
    imageArea: { x: 160, y: 395, width: 480, height: 595 },
  },
  {
    id: 'poster-j',
    framePath: '/poster/BG/poster_BG/j.png',
    backgroundColor: '#4B6BA5',
    frameSize: { width: 800, height: 1376 },
    imageArea: { x: 160, y: 395, width: 480, height: 595 },
  },
  {
    id: 'poster-k',
    framePath: '/poster/BG/poster_BG/k.png',
    backgroundColor: '#F5F3F0',
    frameSize: { width: 800, height: 800 },
    imageArea: { x: 0, y: 0, width: 720, height: 800 }, // 右側のテキストを避ける
  },
  {
    id: 'poster-l',
    framePath: '/poster/BG/poster_BG/l.png',
    backgroundColor: '#F5F3F0',
    frameSize: { width: 800, height: 1026 },
    imageArea: { x: 0, y: 0, width: 625, height: 785 },
  },
  {
    id: 'poster-m',
    framePath: '/poster/BG/poster_BG/m.png',
    backgroundColor: '#6FA8A5',
    frameSize: { width: 800, height: 800 },
    imageArea: { x: 60, y: 68, width: 530, height: 660 },
  },
  {
    id: 'poster-n',
    framePath: '/poster/BG/poster_BG/n.png',
    backgroundColor: '#E8B4B8',
    frameSize: { width: 800, height: 800 },
    imageArea: { x: 160, y: 0, width: 640, height: 800 },
  },
  {
    id: 'poster-o',
    framePath: '/poster/BG/poster_BG/o.png',
    backgroundColor: '#F5F3F0',
    frameSize: { width: 800, height: 801 },
    imageArea: { x: 0, y: 0, width: 720, height: 800 }, // 右側のテキストを避ける
  },
  {
    id: 'poster-p',
    framePath: '/poster/BG/poster_BG/p.png',
    backgroundColor: '#B8A143',
    frameSize: { width: 800, height: 1168 },
    imageArea: { x: 120, y: 230, width: 560, height: 710 },
  },
  {
    id: 'poster-q',
    framePath: '/poster/BG/poster_BG/q.png',
    backgroundColor: '#8B4938',
    frameSize: { width: 800, height: 1168 },
    imageArea: { x: 120, y: 230, width: 565, height: 710 },
  },
];

// Shuffle the templates array once on module load
export const posterTemplates: PosterTemplate[] = shuffleArray(posterTemplatesBase);

// ランダムにテンプレートを選択
export function getRandomTemplate(): PosterTemplate {
  return posterTemplates[Math.floor(Math.random() * posterTemplates.length)];
}

// アセットにポスターテンプレートを適用
export function applyPosterTemplate(imageUrl: string, template?: PosterTemplate): string {
  const selectedTemplate = template || getRandomTemplate();
  // 実際のポスター生成はクライアント側でCanvasを使用
  return selectedTemplate.framePath;
}
