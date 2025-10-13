'use client';

import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { AuthModal } from './AuthModal';
import { CreateMenu } from './CreateMenu';
import { Icons } from './Icons';

interface TopBarProps {
  query: string;
  setQuery: (v: string) => void;
  activeTab: "browse" | "trend" | "create" | "chat" | "creator" | "saved" | "gallery" | "analytics";
  setActiveTab: (t: "browse" | "trend" | "create" | "chat" | "creator" | "saved" | "gallery" | "analytics") => void;
}

function TabBtn({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`chip ${active ? "data-[active=true]:border-accent data-[active=true]:bg-accent data-[active=true]:bg-opacity-10 data-[active=true]:text-accent" : ""}`}
      data-active={active}
    >
      {label}
    </button>
  );
}


export function TopBar({ query, setQuery, activeTab, setActiveTab }: TopBarProps) {
  const { user, signOut, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleAuthClick = () => {
    if (user) {
      signOut();
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-ink-200">
      <div className="w-full px-2 md:px-4 lg:px-6 py-3 flex items-center gap-3">
        <div className="flex items-center gap-3 pr-3">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center">
            <Icons.Sparkles className="text-white" size={16} />
          </div>
          <nav className="hidden md:flex gap-1 items-center">
            <TabBtn label="ホーム" active={activeTab === "browse"} onClick={() => setActiveTab("browse")} />
            <TabBtn label="トレンド" active={activeTab === "trend"} onClick={() => setActiveTab("trend")} />
            <CreateMenu onModeSelect={(mode) => setActiveTab(mode)} activeTab={activeTab} />
            <TabBtn label="マイギャラリー" active={activeTab === "gallery"} onClick={() => setActiveTab("gallery")} />
            <TabBtn label="保存済み" active={activeTab === "saved"} onClick={() => setActiveTab("saved")} />
          </nav>
        </div>

        <div className="flex-1">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl bg-ink-200 bg-opacity-30 pl-10 pr-4 py-2 md:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent border border-transparent"
              placeholder="検索する"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
              <Icons.Search size={16} />
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 pl-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-ink-200 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <img
                src={user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
                alt="Profile"
                className="w-8 h-8 rounded-full border border-ink-200"
              />
              <span className="text-sm font-medium text-ink-900 hidden lg:block">
                {user.user_metadata?.name || user.email?.split('@')[0] || 'User'}
              </span>
              <button
                onClick={handleAuthClick}
                className="text-xs text-ink-400 hover:text-ink-700 px-2 py-1 rounded-lg transition-colors"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <button
              onClick={handleAuthClick}
              className="btn bg-accent text-white border-accent"
            >
              ログイン
            </button>
          )}
        </div>
        
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />
      </div>
    </header>
  );
}