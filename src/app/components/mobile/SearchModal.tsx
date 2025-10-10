import React, { useState, useEffect } from 'react';
import './SearchModal.css';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
}

export function SearchModal({ isOpen, onClose, onSearch }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([
    '検索履歴',
    '検索履歴',
    '検索履歴',
  ]);

  const trendingTags = [
    '#tag', '#tag', '#tag',
    '#tag', '#tag', '#tag',
    '#tag', '#tag', '#tag',
    '#tag', '#tag', '#tag',
  ];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
      onClose();
    }
  };

  const removeHistoryItem = (index: number) => {
    setSearchHistory(prev => prev.filter((_, i) => i !== index));
  };

  const handleTagClick = (tag: string) => {
    onSearch(tag);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay">
      <div className="search-modal-container">
        <button className="search-modal-close" onClick={onClose}>
          ✕
        </button>

        <form onSubmit={handleSearch} className="search-modal-form">
          <div className="search-modal-input-wrapper">
            <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="2"/>
              <path d="M13 13L18 18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              className="search-modal-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder=""
              autoFocus
            />
          </div>
        </form>

        {searchHistory.length > 0 && (
          <div className="search-history">
            {searchHistory.map((item, index) => (
              <div key={index} className="search-history-item">
                <span>{item}</span>
                <button
                  className="search-history-remove"
                  onClick={() => removeHistoryItem(index)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="trending-tags-section">
          <h3 className="trending-tags-title">Trending Tags</h3>
          <div className="trending-tags-grid">
            {trendingTags.map((tag, index) => (
              <button
                key={index}
                className={`trending-tag trending-tag-${index + 1}`}
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
