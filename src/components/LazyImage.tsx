import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  onLoad?: () => void;
  rootMargin?: string; // Intersection Observer のマージン（デフォルト: '50px'）
}

/**
 * 遅延読み込みに対応した画像コンポーネント
 * Intersection Observer APIを使用してビューポートに入ったときに画像を読み込む
 */
export function LazyImage({
  src,
  alt = '',
  className,
  style,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E',
  onLoad,
  rootMargin = '200px', // 200px手前から読み込み開始
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Intersection Observer をセットアップ
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // ビューポートに入ったら画像を読み込む
            setImageSrc(src);
            // 一度読み込んだら監視を停止
            if (observerRef.current && imgRef.current) {
              observerRef.current.unobserve(imgRef.current);
            }
          }
        });
      },
      {
        rootMargin,
        threshold: 0.01,
      }
    );

    // 要素の監視を開始
    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    // クリーンアップ
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [src, rootMargin]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={className}
      style={{
        ...style,
        opacity: isLoaded ? 1 : 0.3,
        transition: 'opacity 0.3s ease-in-out',
      }}
      onLoad={handleLoad}
      loading="lazy" // ブラウザネイティブの遅延読み込みも有効化
    />
  );
}
