'use client';

import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';

interface GenerationAsset {
  id: string;
  r2_url: string;
  width?: number;
  height?: number;
  imagine_image_index: number;
}

interface GenerationResultCardsProps {
  jobId: string;
  assets: GenerationAsset[];
  onCardClick?: (asset: GenerationAsset) => void;
  className?: string;
}

export const GenerationResultCards: React.FC<GenerationResultCardsProps> = ({
  jobId,
  assets,
  onCardClick,
  className = ''
}) => {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Sort assets by image index to ensure consistent display order
  const sortedAssets = [...assets].sort((a, b) => a.imagine_image_index - b.imagine_image_index);

  const handleImageLoad = (assetId: string) => {
    setLoadedImages(prev => new Set([...prev, assetId]));
  };

  const handleImageError = (assetId: string) => {
    setFailedImages(prev => new Set([...prev, assetId]));
  };

  const handleCardClick = (asset: GenerationAsset, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onCardClick?.(asset);
  };

  if (!assets || assets.length === 0) {
    return null;
  }

  return (
    <div className={`generation-result-cards ${className}`}>
      <div className="mb-3 text-sm text-gray-600">
        Generated {assets.length} variation{assets.length !== 1 ? 's' : ''}
      </div>
      
      <div className="grid grid-cols-2 gap-3 max-w-md">
        {sortedAssets.map((asset) => (
          <div
            key={asset.id}
            className="group relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200"
            onClick={(e) => handleCardClick(asset, e)}
          >
            {/* Image Container */}
            <div className="relative aspect-[3/4] bg-gray-50">
              {/* Loading Skeleton */}
              {!loadedImages.has(asset.id) && !failedImages.has(asset.id) && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                  <Icons.Image className="w-8 h-8 text-gray-400" />
                </div>
              )}

              {/* Error State */}
              {failedImages.has(asset.id) && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <Icons.AlertCircle className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                    <div className="text-xs text-gray-500">Failed to load</div>
                  </div>
                </div>
              )}

              {/* Actual Image */}
              {!failedImages.has(asset.id) && (
                <img
                  src={asset.r2_url}
                  alt={`Generated design ${asset.imagine_image_index}`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                    loadedImages.has(asset.id) ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoad={() => handleImageLoad(asset.id)}
                  onError={() => handleImageError(asset.id)}
                  loading="lazy"
                />
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="bg-white rounded-full p-2 shadow-lg">
                    <Icons.ZoomIn className="w-4 h-4 text-gray-700" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="p-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Variation {asset.imagine_image_index}
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Implement upscale functionality
                      console.log('Upscale:', asset.id);
                    }}
                    title="Upscale"
                  >
                    <Icons.ArrowUp className="w-3 h-3" />
                  </button>
                  
                  <button
                    className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Implement variations functionality
                      console.log('Create variations:', asset.id);
                    }}
                    title="Create variations"
                  >
                    <Icons.Shuffle className="w-3 h-3" />
                  </button>
                  
                  <button
                    className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Implement save functionality
                      console.log('Save:', asset.id);
                    }}
                    title="Save to gallery"
                  >
                    <Icons.Heart className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Dimensions */}
              {asset.width && asset.height && (
                <div className="text-xs text-gray-400 mt-1">
                  {asset.width} × {asset.height}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions Row */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Click any image to view full size
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors duration-200"
            onClick={() => {
              // TODO: Implement batch save
              console.log('Save all assets:', assets.map(a => a.id));
            }}
          >
            Save All
          </button>
          
          <button
            className="text-xs px-3 py-1 bg-[#FF7A1A] hover:bg-[#FF7A1A]/90 text-white rounded-full transition-colors duration-200"
            onClick={() => {
              // TODO: Implement publish modal
              console.log('Publish assets:', assets.map(a => a.id));
            }}
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerationResultCards;