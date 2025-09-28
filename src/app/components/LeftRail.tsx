import { Icons } from './Icons';

interface LeftRailProps {
  activeTab: "browse" | "trend" | "create" | "chat" | "creator" | "saved" | "gallery" | "analytics";
  setActiveTab: (t: "browse" | "trend" | "create" | "chat" | "creator" | "saved" | "gallery" | "analytics") => void;
}

function RailIcon({ children, label, active, onClick }: { 
  children: React.ReactNode; 
  label: string; 
  active?: boolean; 
  onClick?: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={`w-11 h-11 grid place-items-center rounded-xl border border-ink-200 text-ink-400 hover:text-ink-700 hover:border-ink-300 transition-all ${
        active ? "bg-accent text-white border-accent" : "hover:bg-ink-200 hover:bg-opacity-20"
      }`}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function LeftRail({ activeTab, setActiveTab }: LeftRailProps) {
  return (
    <aside className="hidden lg:flex lg:sticky lg:top-16 flex-col items-center gap-3 pt-6 w-14 shrink-0">
      <RailIcon label="ホーム" active={activeTab === "browse"} onClick={() => setActiveTab("browse")}>
        <Icons.Home size={18} />
      </RailIcon>
      <RailIcon label="トレンド" active={activeTab === "trend"} onClick={() => setActiveTab("trend")}>
        <Icons.Trending size={18} />
      </RailIcon>
      <RailIcon label="チャット" active={activeTab === "chat"} onClick={() => setActiveTab("chat")}>
        <Icons.Message size={18} />
      </RailIcon>
      <RailIcon label="Creator" active={activeTab === "creator"} onClick={() => setActiveTab("creator")}>
        <Icons.Sparkles size={18} />
      </RailIcon>
      <RailIcon label="マイギャラリー" active={activeTab === "gallery"} onClick={() => setActiveTab("gallery")}>
        <Icons.Gallery size={18} />
      </RailIcon>
      <RailIcon label="保存" active={activeTab === "saved"} onClick={() => setActiveTab("saved")}>
        <Icons.Bookmark size={18} />
      </RailIcon>
      <RailIcon label="分析" active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}>
        <Icons.BarChart size={18} />
      </RailIcon>
      <RailIcon label="プロフィール">
        <Icons.User size={18} />
      </RailIcon>
      <RailIcon label="設定">
        <Icons.Settings size={18} />
      </RailIcon>
    </aside>
  );
}