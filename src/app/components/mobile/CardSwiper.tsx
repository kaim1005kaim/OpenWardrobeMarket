import React, { useState, useRef, TouchEvent } from 'react';
import { Asset } from '../../lib/types';

interface CardSwiperProps {
  assets: Asset[];
  onCardClick: (asset: Asset) => void;
}

export function CardSwiper({ assets, onCardClick }: CardSwiperProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
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
      if (offsetX > 0 && currentIndex > 0) {
        // Swipe right - go to previous
        setCurrentIndex(currentIndex - 1);
      } else if (offsetX < 0 && currentIndex < assets.length - 1) {
        // Swipe left - go to next
        setCurrentIndex(currentIndex + 1);
      }
    }

    setOffsetX(0);
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
    const translateX = diff * 20 + offset * 0.5;
    const translateZ = -Math.abs(diff) * 100;
    const scale = 1 - Math.abs(diff) * 0.1;
    const opacity = diff === 0 ? 1 : 0.6 - Math.abs(diff) * 0.2;
    const rotateY = diff * 5;

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
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
