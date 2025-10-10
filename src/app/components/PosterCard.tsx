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

export function PosterCard({ userImageUrl, template, onClick, className, customText }: PosterCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // キャンバスサイズ設定
    const scale = 2; // 高解像度対応
    canvas.width = 400 * scale;
    canvas.height = 600 * scale;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    ctx.scale(scale, scale);

    // 背景色
    ctx.fillStyle = template.backgroundColor;
    ctx.fillRect(0, 0, 400, 600);

    // ユーザー画像を読み込んで配置
    const userImg = new Image();
    userImg.crossOrigin = 'anonymous';
    userImg.onload = () => {
      const { x, y, width, height } = template.imagePosition;
      const imgX = (x / 100) * 400;
      const imgY = (y / 100) * 600;
      const imgW = (width / 100) * 400;
      const imgH = (height / 100) * 600;

      ctx.drawImage(userImg, imgX, imgY, imgW, imgH);

      // テキスト要素を描画（テンプレートに定義されている場合）
      if (template.textElements) {
        template.textElements.forEach((textEl) => {
          ctx.save();

          ctx.fillStyle = textEl.color;
          ctx.font = `${textEl.fontSize}px ${textEl.fontFamily}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          if (textEl.rotation) {
            ctx.translate(textEl.x, textEl.y);
            ctx.rotate((textEl.rotation * Math.PI) / 180);
            ctx.fillText(textEl.text, 0, 0);
          } else {
            ctx.fillText(textEl.text, textEl.x, textEl.y);
          }

          ctx.restore();
        });
      }

      // カスタムテキストを描画（動的に渡された場合）
      if (customText) {
        ctx.save();

        if (customText.brand) {
          ctx.fillStyle = 'white';
          ctx.font = '12px "Trajan Pro 3", "Cinzel", serif';
          ctx.fillText(customText.brand.toUpperCase(), 20, 20);
        }

        if (customText.title) {
          ctx.fillStyle = 'white';
          ctx.font = '14px "Trajan Pro 3", "Cinzel", serif';
          ctx.textAlign = 'center';
          ctx.fillText(customText.title.toUpperCase(), 200, 560);
        }

        if (customText.creator) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = '10px "Noto Sans JP", sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(customText.creator, 380, 580);
        }

        ctx.restore();
      }

      // テンプレートフレーム（装飾）を最後に重ねる
      const frameImg = new Image();
      frameImg.onload = () => {
        ctx.drawImage(frameImg, 0, 0, 400, 600);
      };
      frameImg.src = template.framePath;
    };
    userImg.src = userImageUrl;
  }, [userImageUrl, template, customText]);

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
