export function HeartIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 20.5s-6.5-4.06-9.2-7.2C1.2 11.5 2 8.5 4.6 7.3 7 6.2 9 7.1 12 9.8c3-2.7 5-3.6 7.4-2.5 2.6 1.2 3.4 4.2 1.8 6-2.7 3.14-9.2 7.2-9.2 7.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}