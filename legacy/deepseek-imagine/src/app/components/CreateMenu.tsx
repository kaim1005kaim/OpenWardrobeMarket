'use client';

import React, { useState } from 'react';
import { Icons } from './Icons';

interface CreateMenuProps {
  onModeSelect: (mode: 'chat' | 'creator') => void;
  activeTab: string;
}

export const CreateMenu: React.FC<CreateMenuProps> = ({ onModeSelect, activeTab }) => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      id: 'chat',
      title: 'AIデザイナー',
      description: 'チャット形式でカジュアルにデザイン生成',
      icon: <Icons.Message className="w-5 h-5" />,
      badge: null,
    },
    {
      id: 'creator',
      title: 'Advanced Creator',
      description: 'Heritage・ZERO・Mutationモードで高度なデザイン',
      icon: <Icons.Sparkles className="w-5 h-5" />,
      badge: 'NEW',
    },
  ];

  const handleSelect = (mode: 'chat' | 'creator') => {
    onModeSelect(mode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
          (activeTab === 'chat' || activeTab === 'creator')
            ? 'bg-gradient-to-r from-[#FF7A1A] to-[#FF9A4A] text-white shadow-md'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Icons.Plus className="w-4 h-4" />
        <span>作成</span>
        <Icons.ArrowUp className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden">
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                デザイン生成モード
              </div>
              
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id as 'chat' | 'creator')}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-[#FF7A1A]/10 to-[#FF9A4A]/10 border border-[#FF7A1A]/20'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`mt-0.5 ${activeTab === item.id ? 'text-[#FF7A1A]' : 'text-gray-400'}`}>
                      {item.icon}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className={`font-medium text-sm ${
                          activeTab === item.id ? 'text-[#FF7A1A]' : 'text-gray-900'
                        }`}>
                          {item.title}
                        </h3>
                        {item.badge && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    
                    {activeTab === item.id && (
                      <div className="mt-1">
                        <Icons.Check className="w-4 h-4 text-[#FF7A1A]" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <Icons.AlertCircle className="w-3 h-3" />
                <span>Advanced Creatorは実験的な新機能です</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CreateMenu;