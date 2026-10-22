import type { ReactNode } from "react";

type IconProps = {
  size?: number;
  className?: string;
};

function Svg({
  size = 18,
  className,
  children,
  filled = false,
}: IconProps & {
  children: ReactNode;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function SparkleIcon({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className} filled>
      <path d="M12 2.5c.6 3.9 2.1 5.4 6 6-3.9.6-5.4 2.1-6 6-.6-3.9-2.1-5.4-6-6 3.9-.6 5.4-2.1 6-6Z" />
      <path d="M19 14c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3Z" />
      <path d="M5.5 15c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5Z" />
    </Svg>
  );
}

export function AskIcon({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 6.8C4 5.8 4.8 5 5.8 5h12.4c1 0 1.8.8 1.8 1.8v7.4c0 1-.8 1.8-1.8 1.8H9l-4 3v-3H5.8c-1 0-1.8-.8-1.8-1.8V6.8Z" />
      <path d="M8 9.2h8M8 12.2h5" />
    </Svg>
  );
}

export function CodeIcon({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="m8 7-4 5 4 5M16 7l4 5-4 5M13.5 5l-3 14" />
    </Svg>
  );
}

export function GenerateIcon({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M11.5 12v4M9.5 14h4" />
    </Svg>
  );
}

export function CleanupIcon({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="m14 5 5 5M13 20l-8-8 5-5 8 8-5 5ZM4 20l3-3" />
      <path d="M5 4v2M4 5h2M19 16v2M18 17h2" />
    </Svg>
  );
}

export function CollaborateIcon({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3 19c.6-3 3-4.6 6-4.6s5.4 1.6 6 4.6M15.5 14.6c2.5.2 4.5 1.7 5 4.4" />
    </Svg>
  );
}

export function ExpandIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </Svg>
  );
}

export function CollapseIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />
    </Svg>
  );
}

export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function CheckIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 12.5 9.5 18 20 6.5" />
    </Svg>
  );
}

export function SavedIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 8.6 4.7 4.7 0 0 0 7 18Z" />
      <path d="m9 13.8 2 2 4-4" />
    </Svg>
  );
}

export function HistoryIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 5v5h5" />
      <path d="M5.4 15a7.5 7.5 0 1 0 .4-7.4L4 10" />
      <path d="M12 8v4.5l3 1.5" />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function SendIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  );
}

export function CopyIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H5.8C4.8 4 4 4.8 4 5.8v7.7A1.5 1.5 0 0 0 5.5 15" />
    </Svg>
  );
}

export function DownloadIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
    </Svg>
  );
}

export function ApplyIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 12.5 9.5 18 20 6.5" />
      <path d="M20 12v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
    </Svg>
  );
}

export function StopIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </Svg>
  );
}

export function ArrowLeftIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Svg>
  );
}

export function ArrowRightIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function BoardIcon({ size = 16, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M9 9v11" />
    </Svg>
  );
}

export function NodeKindIcon({
  kind,
  size = 14,
  className,
}: IconProps & { kind: string }) {
  if (kind === "ellipse") {
    return (
      <Svg size={size} className={className}>
        <circle cx="12" cy="12" r="8" />
      </Svg>
    );
  }

  if (kind === "diamond") {
    return (
      <Svg size={size} className={className}>
        <path d="m12 3 9 9-9 9-9-9 9-9Z" />
      </Svg>
    );
  }

  if (kind === "text") {
    return (
      <Svg size={size} className={className}>
        <path d="M5 6h14M12 6v13M8 19h8" />
      </Svg>
    );
  }

  if (kind === "freedraw") {
    return (
      <Svg size={size} className={className}>
        <path d="M4 17c3-6 5-10 8-10s3 5 6 5 2-3 2-3" />
      </Svg>
    );
  }

  return (
    <Svg size={size} className={className}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
    </Svg>
  );
}
