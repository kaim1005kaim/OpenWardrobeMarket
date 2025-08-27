interface LeftRailProps {
  activeTab: "browse" | "trend" | "create" | "saved";
  setActiveTab: (t: "browse" | "trend" | "create" | "saved") => void;
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
      className={`w-11 h-11 grid place-items-center rounded-full border text-base ${
        active ? "bg-black text-white border-black" : "hover:bg-black/5"
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
      <RailIcon label="ホーム" active={activeTab === "browse"} onClick={() => setActiveTab("browse")}>●</RailIcon>
      <RailIcon label="トレンド" active={activeTab === "trend"} onClick={() => setActiveTab("trend")}>★</RailIcon>
      <RailIcon label="作成" active={activeTab === "create"} onClick={() => setActiveTab("create")}>＋</RailIcon>
      <RailIcon label="保存" active={activeTab === "saved"} onClick={() => setActiveTab("saved")}>⎙</RailIcon>
      <RailIcon label="プロフィール">○</RailIcon>
      <RailIcon label="設定">⚙</RailIcon>
    </aside>
  );
}