import React, { useEffect, useRef } from 'react';
import { PosterTemplate } from '../lib/posterTemplates';

interface PosterCardProps {
  userImageUrl: string;
  template: PosterTemplate;
  onClick?: () => void;
  className?: string;
  customText?: {
    title?: string;
    creator?: string;
    brand?: string;
  };
}

export function PosterCard({ userImageUrl, template, onClick, className }: PosterCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // キャンバスサイズ設定（各フレームPNGの実際のサイズに合わせる）
    const WIDTH = template.frameSize.width;
    const HEIGHT = template.frameSize.height;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // 背景色
    ctx.fillStyle = template.backgroundColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // ユーザー画像を読み込んで配置
    const userImg = new Image();
    userImg.crossOrigin = 'anonymous';
    userImg.onload = () => {
      const { x, y, width, height } = template.imageArea;

      // 画像をカバー方式で配置（アスペクト比を保ちつつエリアを埋める）
      const imgAspect = userImg.width / userImg.height;
      const areaAspect = width / height;

      let drawWidth, drawHeight, drawX, drawY;

      if (imgAspect > areaAspect) {
        // 画像が横長 → 高さに合わせる
        drawHeight = height;
        drawWidth = height * imgAspect;
        drawX = x - (drawWidth - width) / 2;
        drawY = y;
      } else {
        // 画像が縦長 → 幅に合わせる
        drawWidth = width;
        drawHeight = width / imgAspect;
        drawX = x;
        drawY = y - (drawHeight - height) / 2;
      }

      // 画像エリアをクリップ
      ctx.save();
      ctx.rect(x, y, width, height);
      ctx.clip();
      ctx.drawImage(userImg, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();

      // 透過フレームを最後に重ねる
      const frameImg = new Image();
      frameImg.onload = () => {
        console.log('Frame loaded successfully:', template.framePath, 'Size:', frameImg.width, 'x', frameImg.height);
        ctx.drawImage(frameImg, 0, 0, WIDTH, HEIGHT);
        console.log('Frame drawn on canvas');
      };
      frameImg.onerror = () => {
        console.error('Failed to load frame:', template.framePath);
      };
      frameImg.src = template.framePath;
    };
    userImg.onerror = () => {
      console.error('Failed to load user image:', userImageUrl);
      // エラー時もフレームを表示
      const frameImg = new Image();
      frameImg.onload = () => {
        ctx.drawImage(frameImg, 0, 0, WIDTH, HEIGHT);
      };
      frameImg.src = template.framePath;
    };
    userImg.src = userImageUrl;
  }, [userImageUrl, template]);

  return (
    <div className={className} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          borderRadius: '4px',
        }}
      />
    </div>
  );
}
