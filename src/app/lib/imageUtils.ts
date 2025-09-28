/**
 * Image processing utilities for performance optimization
 */

export interface ImageMeta {
  width: number;
  height: number;
  aspectRatio: string;
  blurDataURL?: string;
  dominantColor?: string;
}

/**
 * Generate a low-quality placeholder (blur) image from a File or Blob
 */
export async function generateBlurPlaceholder(file: File | Blob): Promise<ImageMeta> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = async () => {
      try {
        // Get original dimensions
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const aspectRatio = `${width} / ${height}`;
        
        // Create tiny version for blur (20px wide)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');
        
        const blurWidth = 20;
        const blurHeight = Math.round((height / width) * blurWidth);
        
        canvas.width = blurWidth;
        canvas.height = blurHeight;
        
        // Draw and get blur data
        ctx.drawImage(img, 0, 0, blurWidth, blurHeight);
        const blurDataURL = canvas.toDataURL('image/jpeg', 0.6);
        
        // Get dominant color from center pixel
        const imageData = ctx.getImageData(blurWidth / 2, blurHeight / 2, 1, 1);
        const [r, g, b] = imageData.data;
        const dominantColor = `rgb(${r}, ${g}, ${b})`;
        
        URL.revokeObjectURL(url);
        
        resolve({
          width,
          height,
          aspectRatio,
          blurDataURL,
          dominantColor
        });
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Generate blur placeholder from an image URL
 */
export async function generateBlurFromURL(url: string): Promise<ImageMeta> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = async () => {
      try {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const aspectRatio = `${width} / ${height}`;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');
        
        const blurWidth = 20;
        const blurHeight = Math.round((height / width) * blurWidth);
        
        canvas.width = blurWidth;
        canvas.height = blurHeight;
        
        ctx.drawImage(img, 0, 0, blurWidth, blurHeight);
        const blurDataURL = canvas.toDataURL('image/jpeg', 0.6);
        
        const imageData = ctx.getImageData(blurWidth / 2, blurHeight / 2, 1, 1);
        const [r, g, b] = imageData.data;
        const dominantColor = `rgb(${r}, ${g}, ${b})`;
        
        resolve({
          width,
          height,
          aspectRatio,
          blurDataURL,
          dominantColor
        });
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Generate responsive image sizes
 */
export function generateSrcSet(baseUrl: string, sizes: number[] = [400, 800, 1200]): string {
  // For now, return the same URL - will be enhanced when using CDN transforms
  return sizes.map(size => `${baseUrl} ${size}w`).join(', ');
}

/**
 * Calculate optimal sizes attribute based on grid layout
 */
export function calculateSizes(): string {
  return `(max-width: 640px) calc(50vw - 1rem), (max-width: 1024px) calc(33.333vw - 1rem), calc(20vw - 1rem)`;
}