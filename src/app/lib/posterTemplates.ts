export interface PosterTemplate {
  id: string;
  framePath: string;
  backgroundColor: string;
  imagePosition: {
    x: number; // percentage
    y: number; // percentage
    width: number; // percentage
    height: number; // percentage
  };
  textElements?: {
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    fontFamily: string;
    rotation?: number;
  }[];
}

export const posterTemplates: PosterTemplate[] = [
  {
    id: 'frame-52',
    framePath: '/poster/Frame 52.png',
    backgroundColor: '#4A6FA5',
    imagePosition: { x: 15, y: 15, width: 70, height: 70 },
  },
  {
    id: 'frame-53',
    framePath: '/poster/Frame 53.png',
    backgroundColor: '#C84141',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
  {
    id: 'frame-54',
    framePath: '/poster/Frame 54.png',
    backgroundColor: '#4A6FA5',
    imagePosition: { x: 15, y: 15, width: 70, height: 70 },
  },
  {
    id: 'frame-55',
    framePath: '/poster/Frame 55.png',
    backgroundColor: '#F5A623',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
  {
    id: 'frame-56',
    framePath: '/poster/Frame 56.png',
    backgroundColor: '#1a3d3d',
    imagePosition: { x: 5, y: 5, width: 65, height: 90 },
  },
  {
    id: 'frame-57',
    framePath: '/poster/Frame 57.png',
    backgroundColor: '#50B5B5',
    imagePosition: { x: 10, y: 10, width: 80, height: 70 },
  },
  {
    id: 'frame-58',
    framePath: '/poster/Frame 58.png',
    backgroundColor: '#E91E63',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
  {
    id: 'frame-59',
    framePath: '/poster/Frame 59.png',
    backgroundColor: '#C8E6C9',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
  {
    id: 'frame-60',
    framePath: '/poster/Frame 60.png',
    backgroundColor: '#CE93D8',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
  {
    id: 'frame-61',
    framePath: '/poster/Frame 61.png',
    backgroundColor: '#FFF59D',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
  {
    id: 'frame-62',
    framePath: '/poster/Frame 62.png',
    backgroundColor: '#FFE0B2',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
  {
    id: 'frame-63',
    framePath: '/poster/Frame 63.png',
    backgroundColor: '#5F9EA0',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
  {
    id: 'frame-64',
    framePath: '/poster/Frame 64.png',
    backgroundColor: '#C41E3A',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
  {
    id: 'frame-66',
    framePath: '/poster/Frame 66.png',
    backgroundColor: '#B8860B',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
  {
    id: 'frame-67',
    framePath: '/poster/Frame 67.png',
    backgroundColor: '#F5F5F5',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
  {
    id: 'frame-68',
    framePath: '/poster/Frame 68.png',
    backgroundColor: '#FF6B35',
    imagePosition: { x: 10, y: 10, width: 80, height: 80 },
  },
];

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
