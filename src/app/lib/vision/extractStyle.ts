/**
 * Style extraction utilities using client-side analysis
 * CLIP Interrogator alternative + color extraction
 */

interface StyleAnalysis {
  vibe: string[];
  colors: string[];
  silhouette: string[];
  tags: string[];
}

interface ColorInfo {
  hex: string;
  name: string;
  prominence: number;
}

/**
 * Extract dominant colors from image using Canvas API
 */
export async function extractColors(imageFile: File): Promise<ColorInfo[]> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    img.onload = () => {
      // リサイズして処理負荷を軽減
      const maxSize = 200;
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const colors = extractDominantColors(imageData);
      resolve(colors);
    };
    
    img.src = URL.createObjectURL(imageFile);
  });
}

/**
 * K-means clustering for dominant color extraction
 */
function extractDominantColors(imageData: ImageData): ColorInfo[] {
  const pixels = [];
  const data = imageData.data;
  
  // サンプリング（4px間隔）
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];
    
    if (alpha > 128) { // 透明でない部分のみ
      pixels.push([r, g, b]);
    }
  }
  
  // K-meansクラスタリング（k=5）
  const clusters = kMeans(pixels, 5);
  
  return clusters.map((cluster) => {
    const [r, g, b] = cluster.center.map(Math.round);
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    
    return {
      hex,
      name: getColorName([r, g, b]),
      prominence: cluster.size / pixels.length
    };
  }).sort((a, b) => b.prominence - a.prominence);
}

/**
 * Simple K-means implementation
 */
function kMeans(points: number[][], k: number) {
  if (points.length === 0) return [];
  
  // 初期中心点をランダム選択
  const centers: number[][] = [];
  for (let i = 0; i < k; i++) {
    centers.push([...points[Math.floor(Math.random() * points.length)]]);
  }
  
  let converged = false;
  let iterations = 0;
  
  while (!converged && iterations < 20) {
    const clusters: { center: number[], points: number[][] }[] = centers.map(center => ({
      center: [...center],
      points: []
    }));
    
    // 各点を最も近い中心に割り当て
    points.forEach(point => {
      let minDistance = Infinity;
      let closestIndex = 0;
      
      centers.forEach((center, index) => {
        const distance = euclideanDistance(point, center);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      
      clusters[closestIndex].points.push(point);
    });
    
    // 中心点を更新
    converged = true;
    clusters.forEach((cluster, index) => {
      if (cluster.points.length > 0) {
        const newCenter = [0, 0, 0];
        cluster.points.forEach(point => {
          newCenter[0] += point[0];
          newCenter[1] += point[1];
          newCenter[2] += point[2];
        });
        newCenter[0] /= cluster.points.length;
        newCenter[1] /= cluster.points.length;
        newCenter[2] /= cluster.points.length;
        
        if (euclideanDistance(newCenter, centers[index]) > 1) {
          converged = false;
        }
        centers[index] = newCenter;
      }
    });
    
    iterations++;
  }
  
  return centers.map((center, index) => ({
    center,
    size: points.filter(point => {
      let minDistance = Infinity;
      let closestIndex = 0;
      centers.forEach((c, i) => {
        const distance = euclideanDistance(point, c);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      });
      return closestIndex === index;
    }).length
  }));
}

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

/**
 * Convert RGB to color name
 */
function getColorName([r, g, b]: number[]): string {
  const colors = [
    { name: 'black', rgb: [0, 0, 0] },
    { name: 'white', rgb: [255, 255, 255] },
    { name: 'red', rgb: [255, 0, 0] },
    { name: 'green', rgb: [0, 128, 0] },
    { name: 'blue', rgb: [0, 0, 255] },
    { name: 'yellow', rgb: [255, 255, 0] },
    { name: 'cyan', rgb: [0, 255, 255] },
    { name: 'magenta', rgb: [255, 0, 255] },
    { name: 'gray', rgb: [128, 128, 128] },
    { name: 'navy', rgb: [0, 0, 128] },
    { name: 'brown', rgb: [165, 42, 42] },
    { name: 'orange', rgb: [255, 165, 0] },
    { name: 'purple', rgb: [128, 0, 128] },
    { name: 'pink', rgb: [255, 192, 203] },
    { name: 'beige', rgb: [245, 245, 220] }
  ];

  let closestColor = colors[0];
  let minDistance = Infinity;

  colors.forEach(color => {
    const distance = euclideanDistance([r, g, b], color.rgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  });

  return closestColor.name;
}

/**
 * Analyze fashion vibe from image using simple heuristics
 * (In production, this would use CLIP or similar vision model)
 */
export async function analyzeImageVibe(imageFile: File): Promise<StyleAnalysis> {
  try {
    const colors = await extractColors(imageFile);
    const dominantColors = colors.slice(0, 3);
    
    // 色ベースの簡易分析
    const vibeAnalysis = inferVibeFromColors(dominantColors);
    const paletteDescription = describePalette(dominantColors);
    
    return {
      vibe: vibeAnalysis.vibes,
      colors: dominantColors.map(c => c.name),
      silhouette: vibeAnalysis.silhouettes,
      tags: [...vibeAnalysis.vibes, ...paletteDescription, ...dominantColors.map(c => c.name)]
    };
  } catch (error) {
    console.error('Image analysis error:', error);
    return {
      vibe: ['casual'],
      colors: ['neutral'],
      silhouette: ['relaxed'],
      tags: ['casual', 'neutral']
    };
  }
}

function inferVibeFromColors(colors: ColorInfo[]) {
  const colorNames = colors.map(c => c.name.toLowerCase());
  const vibes = [];
  const silhouettes = [];
  
  if (colorNames.includes('black') && colors[0].name === 'black') {
    vibes.push('minimal', 'elegant', 'sophisticated');
    silhouettes.push('tailored', 'structured');
  }
  
  if (colorNames.includes('white') || colorNames.includes('beige')) {
    vibes.push('clean', 'minimal', 'fresh');
    silhouettes.push('relaxed', 'flowing');
  }
  
  if (colorNames.some(c => ['red', 'yellow', 'orange'].includes(c))) {
    vibes.push('bold', 'energetic', 'street');
    silhouettes.push('oversized', 'statement');
  }
  
  if (colorNames.some(c => ['blue', 'navy', 'cyan'].includes(c))) {
    vibes.push('classic', 'professional', 'calm');
    silhouettes.push('tailored', 'structured');
  }
  
  if (colorNames.some(c => ['pink', 'purple', 'magenta'].includes(c))) {
    vibes.push('playful', 'feminine', 'romantic');
    silhouettes.push('flowing', 'soft');
  }
  
  if (colorNames.includes('gray') || colors.every(c => c.prominence < 0.3)) {
    vibes.push('neutral', 'versatile', 'understated');
    silhouettes.push('relaxed', 'casual');
  }
  
  return {
    vibes: vibes.length > 0 ? vibes : ['casual'],
    silhouettes: silhouettes.length > 0 ? silhouettes : ['relaxed']
  };
}

function describePalette(colors: ColorInfo[]): string[] {
  const descriptions = [];
  
  if (colors.length <= 2) {
    descriptions.push('monochrome', 'minimalist');
  } else if (colors.length >= 4) {
    descriptions.push('colorful', 'vibrant');
  }
  
  const brightness = colors.reduce((sum, c) => {
    const rgb = hexToRgb(c.hex);
    return sum + (rgb.r + rgb.g + rgb.b) / 3;
  }, 0) / colors.length;
  
  if (brightness > 200) {
    descriptions.push('light', 'bright');
  } else if (brightness < 80) {
    descriptions.push('dark', 'moody');
  } else {
    descriptions.push('balanced', 'natural');
  }
  
  return descriptions;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Generate fashion tags from analysis results
 */
export function generateFashionTags(analysis: StyleAnalysis): string[] {
  const allTags = [...new Set([...analysis.vibe, ...analysis.colors, ...analysis.silhouette])];
  
  // ファッション特化の関連タグを追加
  const expandedTags: string[] = [];
  
  allTags.forEach(tag => {
    expandedTags.push(tag);
    
    // 関連タグの追加
    const relatedTags = getRelatedFashionTags(tag);
    expandedTags.push(...relatedTags);
  });
  
  return [...new Set(expandedTags)].slice(0, 10); // 最大10タグ
}

function getRelatedFashionTags(tag: string): string[] {
  const relations: { [key: string]: string[] } = {
    'minimal': ['clean', 'simple', 'understated'],
    'street': ['urban', 'casual', 'contemporary'],
    'elegant': ['sophisticated', 'refined', 'luxury'],
    'black': ['monochrome', 'classic', 'timeless'],
    'oversized': ['relaxed', 'comfortable', 'modern'],
    'tailored': ['professional', 'structured', 'formal']
  };
  
  return relations[tag.toLowerCase()] || [];
}