import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';

interface GenerationAsset {
  id: string;
  r2_url: string;
  width?: number;
  height?: number;
  imagine_image_index: number;
}

interface ImageDetailModalProps {
  asset: GenerationAsset | null;
  isOpen: boolean;
  onClose: () => void;
  jobId?: string;
}

export const ImageDetailModal: React.FC<ImageDetailModalProps> = ({
  asset,
  isOpen,
  onClose,
  jobId
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (isOpen && asset) {
      setIsLoading(true);
      setImageError(false);
    }
  }, [isOpen, asset]);

  if (!isOpen || !asset) return null;

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
  };

  const handleDownload = () => {
    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = asset.r2_url;
    link.download = `generation-${asset.id}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Generated Fashion Image',
          url: asset.r2_url,
        });
      } catch (err) {
        // Fall back to clipboard
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(asset.r2_url);
      // You might want to show a toast notification here
      console.log('Image URL copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-75 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Generated Image #{asset.imagine_image_index}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Container */}
        <div className="relative flex items-center justify-center bg-gray-50 min-h-[400px] max-h-[60vh] overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          
          {imageError ? (
            <div className="flex flex-col items-center justify-center text-gray-500 p-8">
              <Icons.ImageOff className="w-12 h-12 mb-2" />
              <p>Failed to load image</p>
            </div>
          ) : (
            <img
              src={asset.r2_url}
              alt={`Generated image ${asset.imagine_image_index}`}
              className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
                isLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {/* Image Info */}
            <div className="text-sm text-gray-600">
              <div>Dimensions: {asset.width} × {asset.height}</div>
              {jobId && (
                <div className="truncate max-w-xs">Job ID: {jobId}</div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleShare}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Icons.Share className="w-4 h-4" />
                <span>Share</span>
              </button>
              
              <button
                onClick={handleDownload}
                className="flex items-center space-x-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Icons.Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};