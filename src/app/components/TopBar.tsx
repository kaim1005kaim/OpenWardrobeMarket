interface TopBarProps {
  query: string;
  setQuery: (v: string) => void;
  activeTab: "browse" | "trend" | "create" | "saved";
  setActiveTab: (t: "browse" | "trend" | "create" | "saved") => void;
}

function TabBtn({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 md:px-4 py-2 rounded-full text-sm font-medium ${
        active ? "bg-black text-white" : "hover:bg-black/5"
      }`}
    >
      {label}
    </button>
  );
}

function IconBtn({ children, ariaLabel }: { children: React.ReactNode; ariaLabel: string }) {
  return (
    <button
      aria-label={ariaLabel}
      className="w-9 h-9 grid place-items-center rounded-full hover:bg-black/5"
    >
      {children}
    </button>
  );
}

export function TopBar({ query, setQuery, activeTab, setActiveTab }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b">
      <div className="max-w-[1600px] mx-auto px-2 md:px-4 py-2 flex items-center gap-2">
        <div className="flex items-center gap-2 pr-2">
          <div className="w-8 h-8 rounded-xl bg-black" />
          <nav className="hidden md:flex gap-1">
            <TabBtn label="ホーム" active={activeTab === "browse"} onClick={() => setActiveTab("browse")} />
            <TabBtn label="トレンド" active={activeTab === "trend"} onClick={() => setActiveTab("trend")} />
            <TabBtn label="作成" active={activeTab === "create"} onClick={() => setActiveTab("create")} />
            <TabBtn label="保存済み" active={activeTab === "saved"} onClick={() => setActiveTab("saved")} />
          </nav>
        </div>

        <div className="flex-1">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full bg-zinc-100 pl-11 pr-4 py-2 md:py-2.5 focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="検索する"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2">🔎</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 pl-2">
          <IconBtn ariaLabel="通知">•</IconBtn>
          <IconBtn ariaLabel="メッセージ">•</IconBtn>
          <div className="w-8 h-8 rounded-full bg-zinc-300" title="プロフィール" />
        </div>
      </div>
    </header>
  );
}