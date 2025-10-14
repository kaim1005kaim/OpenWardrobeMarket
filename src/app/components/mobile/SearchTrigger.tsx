import './SearchTrigger.css';

interface SearchTriggerProps {
  placeholder?: string;
  tone?: 'light' | 'dark';
  onClick: () => void;
  className?: string;
  showLabel?: boolean;
}

export function SearchTrigger({
  placeholder = 'Search...',
  tone = 'light',
  onClick,
  className,
  showLabel = true
}: SearchTriggerProps) {
  return (
    <div className={`search-trigger-wrapper ${className ?? ''}`.trim()}>
      {showLabel && (
        <div className={`search-trigger-label search-trigger-label--${tone}`}>SERCH</div>
      )}
      <div
        className={`search-trigger search-trigger--${tone}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        }}
      >
        <svg className="search-trigger__icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 12L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="search-trigger__placeholder">{placeholder}</span>
      </div>
    </div>
  );
}
