import React, { useState, useRef, TouchEvent, useEffect, useCallback } from 'react';
import { Asset } from '../../lib/types';

interface CardSwiperProps {
  assets: Asset[];
  onCardClick: (asset: Asset) => void;
  autoAdvanceInterval?: number;
  onIndexChange?: (index: number) => void;
  initialIndex?: number;
}

export function CardSwiper({
  assets,
  onCardClick,
  autoAdvanceInterval,
  onIndexChange,
  initialIndex
}: CardSwiperProps) {
  const [currentIndex, setCurrentIndexState] = useState(initialIndex ?? 0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const assetsLengthRef = useRef(assets.length);

  useEffect(() => {
    assetsLengthRef.current = assets.length;
  }, [assets.length]);

  const updateIndex = useCallback(
    (value: number | ((prev: number) => number)) => {
      setCurrentIndexState((prev) => {
        if (assets.length === 0) return 0;
        const nextValue = typeof value === 'function' ? (value as (prev: number) => number)(prev) : value;
        const bounded = ((nextValue % assets.length) + assets.length) % assets.length;
        if (bounded !== prev) {
          onIndexChange?.(bounded);
        } else if (typeof value !== 'function') {
          onIndexChange?.(bounded);
        }
        return bounded;
      });
    },
    [assets.length, onIndexChange]
  );

  useEffect(() => {
    if (typeof initialIndex === 'number') {
      updateIndex(initialIndex);
    }
  }, [initialIndex, updateIndex]);

  useEffect(() => {
    // Reset index if assets list shrinks dramatically
    if (currentIndex >= assets.length && assets.length > 0) {
      updateIndex(0);
    }
  }, [assets.length, currentIndex, updateIndex]);

  const restartAutoTimer = useCallback(() => {
    if (!autoAdvanceInterval || assets.length <= 1) {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return;
    }

    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
    }

    autoTimerRef.current = setInterval(() => {
      updateIndex((prev) => prev + 1);
    }, autoAdvanceInterval);
  }, [autoAdvanceInterval, assets.length, updateIndex]);

  useEffect(() => {
    restartAutoTimer();
    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
      }
    };
  }, [restartAutoTimer]);

  const handleTouchStart = (e: TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    setOffsetX(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    // Swipe threshold: 50px
    if (Math.abs(offsetX) > 50) {
      if (offsetX > 0) {
        updateIndex((prev) => prev - 1);
      } else if (offsetX < 0) {
        updateIndex((prev) => prev + 1);
      }
    }

    setOffsetX(0);
    restartAutoTimer();
  };

  const handleCardClick = (asset: Asset, index: number) => {
    if (index === currentIndex && Math.abs(offsetX) < 10) {
      onCardClick(asset);
    }
  };

  const getCardStyle = (index: number): React.CSSProperties => {
    const diff = index - currentIndex;
    const offset = isDragging ? offsetX : 0;

    // Calculate position and scale
    const translateX = diff * 55 + offset * 0.45;
    const translateZ = -Math.abs(diff) * 120;
    const scale = 1 - Math.abs(diff) * 0.08;
    const opacity = diff === 0 ? 1 : Math.max(0.2, 0.55 - Math.abs(diff) * 0.15);
    const rotateY = diff * 4;

    return {
      transform: `translateX(${translateX}px) translateZ(${translateZ}px) scale(${scale}) rotateY(${rotateY}deg)`,
      opacity: Math.max(0, opacity),
      zIndex: 100 - Math.abs(diff),
      transition: isDragging ? 'none' : 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    };
  };

  if (assets.length === 0) return null;

  return (
    <div className="card-swiper-container">
      <div
        className="card-swiper"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {assets.map((asset, index) => (
          <div
            key={asset.id}
            className="swiper-card"
            style={getCardStyle(index)}
            onClick={() => handleCardClick(asset, index)}
          >
            <div className="card-image-container">
              <img src={asset.src} alt={asset.title} loading="lazy" />
              <div className="card-vertical-title card-vertical-title-left">{asset.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination dots */}
      <div className="swiper-pagination">
        {assets.map((_, index) => (
          <div
            key={index}
            className={`pagination-dot ${index === currentIndex ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              updateIndex(index);
              restartAutoTimer();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                updateIndex(index);
                restartAutoTimer();
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
