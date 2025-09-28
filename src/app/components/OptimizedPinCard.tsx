'use client';

import { useState, useEffect, useRef } from 'react';
import { Asset } from '../lib/types';

// Custom hook for viewport detection
function useInViewport<T extends Element>(rootMargin = '50px') {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);
  const [hasBeenInView, setHasBeenInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
        if (entry.isIntersecting && !hasBeenInView) {
          setHasBeenInView(true);
        }
      },
      { rootMargin }
    );

    const element = ref.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [rootMargin, hasBeenInView]);

  return { ref, isInView, hasBeenInView };
}

interface OptimizedPinCardProps {
  asset: Asset;
  onOpen?: () => void;
  onLike?: () => void;
  isFirstRow?: boolean;
  showOwnerActions?: boolean;
}

export function OptimizedPinCard({ 
  asset, 
  onOpen, 
  onLike,
  isFirstRow = false,
  showOwnerActions: _showOwnerActions = false
}: OptimizedPinCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { ref, hasBeenInView } = useInViewport<HTMLDivElement>('200px');
  
  // Calculate aspect ratio
  const aspectRatio = asset.w && asset.h 
    ? `${asset.w} / ${asset.h}` 
    : asset.aspect_ratio || '3 / 4';
  
  // Use blur placeholder or dominant color
  const placeholder = asset.blur_data_url || asset.dominant_color || '#f3f4f6';
  const useBlur = !!asset.blur_data_url;
  
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  return (
    <div 
      ref={ref}
      className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gray-100 transition-transform hover:scale-[1.02]"
      style={{ aspectRatio }}
      onClick={onOpen}
    >
      {/* Placeholder layer */}
      <div 
        className={`absolute inset-0 transition-opacity duration-500 ${
          imageLoaded ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          backgroundColor: !useBlur ? placeholder : undefined,
          backgroundImage: useBlur ? `url(${placeholder})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: useBlur ? 'blur(20px)' : undefined,
          transform: useBlur ? 'scale(1.1)' : undefined,
        }}
      />
      
      {/* Main image - only render when in viewport */}
      {hasBeenInView && !imageError && (
        <img
          src={asset.src}
          alt={asset.title}
          loading={isFirstRow ? 'eager' : 'lazy'}
          fetchPriority={isFirstRow ? 'high' : 'low'}
          decoding="async"
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            willChange: imageLoaded ? 'auto' : 'opacity',
          }}
        />
      )}
      
      {/* Error state */}
      {imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className="text-center text-gray-400">
            <svg className="mx-auto h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="text-xs">Failed to load</div>
          </div>
        </div>
      )}
      
      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50 opacity-0 transition-opacity group-hover:opacity-100" />
      
      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 text-white opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex items-end justify-between">
          <div className="flex-1 overflow-hidden">
            <h3 className="truncate text-sm font-medium">{asset.title}</h3>
            {asset.creator && (
              <p className="truncate text-xs opacity-75">{asset.creator}</p>
            )}
          </div>
          
          {/* Like button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike?.();
            }}
            className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur transition hover:bg-white/30"
            aria-label="Like"
          >
            <svg className="h-4 w-4" fill={asset.liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>
        
        {/* Tags */}
        {asset.tags && asset.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {asset.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] backdrop-blur">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {/* Ad badge */}
      {asset.isAd && (
        <div className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur">
          Ad
        </div>
      )}
      
      {/* Like count */}
      {asset.likes !== undefined && asset.likes > 0 && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur opacity-0 transition-opacity group-hover:opacity-100">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          {asset.likes}
        </div>
      )}
    </div>
  );
}