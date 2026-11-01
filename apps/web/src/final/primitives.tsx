import type React from 'react';
import { useGame } from './session.tsx';
export function Icon({
  name,
  size = 18,
}: {
  name: 'grid' | 'pulse' | 'transfer' | 'audio' | 'chevron' | 'lock' | 'people' | 'close';
  size?: number;
}) {
  const paths = {
    grid: (
      <>
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
      </>
    ),
    pulse: <path d="M2 12h4l2.5-7 4.4 14L16 9l2 3h4" />,
    transfer: (
      <>
        <path d="M5 7h14M15 3l4 4-4 4M19 17H5M9 13l-4 4 4 4" />
      </>
    ),
    audio: (
      <>
        <path d="M4 10v4h4l5 4V6L8 10H4zM17 9c1.5 1.7 1.5 4.3 0 6M20 6c3.3 3.3 3.3 8.7 0 12" />
      </>
    ),
    chevron: <path d="m8 5 7 7-7 7" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="1" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c.4-4 2.4-6 6-6s5.6 2 6 6M15 15c3.5-.3 5.4 1.4 6 4.5" />
      </>
    ),
    close: <path d="M5 5l14 14M19 5 5 19" />,
  };
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Button({
  children,
  className = '',
  onClick,
  disabled = false,
  ariaLabel,
}: {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const { readOnly } = useGame();
  if (readOnly) return <span className={`passive-control ${className}`}>{children}</span>;
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <div className="brand-mark">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>TORCHLINE</strong>
        {!compact && <small>THE ARK PROTOCOL</small>}
      </div>
    </div>
  );
}

export function ResourceBar({
  label,
  value,
  tone = 'normal',
  unit = '%',
  max = 100,
}: {
  label: string;
  value: number;
  tone?: 'normal' | 'warning' | 'critical';
  /** Supplies are counted crates, not a percentage, and can exceed one hundred. */
  unit?: string;
  max?: number;
}) {
  return (
    <div className={`resource resource--${tone}`}>
      <div className="resource-label">
        <span>{label}</span>
        <strong
          data-resource={
            {
              'HULL INTEGRITY': 'hull',
              'OXYGEN RESERVE': 'oxygen',
              'POWER LOAD': 'power',
              NAVIGATION: 'navigation',
              SUPPLIES: 'supplies',
            }[label]
          }
          data-value={value}
        >
          {value}
          <small>{unit === '%' ? '%' : ` ${unit}`}</small>
        </strong>
      </div>
      <div className="resource-track">
        <span
          style={{ '--value': `${Math.min(100, (value / max) * 100)}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
