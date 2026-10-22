export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="16" fill="#17161a" />
      <path
        d="M10.5 12.4c0-1.3 1-2.4 2.3-2.4h6.4c1.3 0 2.3 1.1 2.3 2.4s-1 2.4-2.3 2.4h-6.4v5.1c0 1.3 1 2.4 2.3 2.4h2.4c1.3 0 2.3-1.1 2.3-2.4"
        stroke="#f7f3e9"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
