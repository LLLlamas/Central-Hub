// Minimal inline SVG icon set. No icon-pack dependency.
// Each icon: 16x16, stroke-only, currentColor.
import type { CSSProperties } from 'react';

type IconProps = { size?: number; className?: string; style?: CSSProperties };

function S({ children, size = 16, className, style }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Calendar: (p: IconProps) => (
    <S {...p}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </S>
  ),
  Users: (p: IconProps) => (
    <S {...p}>
      <circle cx="6" cy="6" r="2.5" />
      <path d="M2 13.5c0-2 2-3.5 4-3.5s4 1.5 4 3.5" />
      <circle cx="11" cy="5.5" r="1.8" />
      <path d="M10 9.5c2 0 3.5 1.2 3.5 3" />
    </S>
  ),
  Layers: (p: IconProps) => (
    <S {...p}>
      <path d="M8 2L2 5l6 3 6-3-6-3z" />
      <path d="M2 10l6 3 6-3" />
      <path d="M2 7.5l6 3 6-3" />
    </S>
  ),
  Document: (p: IconProps) => (
    <S {...p}>
      <path d="M3.5 1.5h6l3 3v10h-9z" />
      <path d="M9.5 1.5v3h3" />
      <path d="M5.5 7.5h5M5.5 9.5h5M5.5 11.5h3" />
    </S>
  ),
  Plane: (p: IconProps) => (
    <S {...p}>
      <path d="M2 9.5l5-2 1-4.5 1 4.5 5 2v1.5l-5-1-1 4 1 1v.5l-2-1-2 1v-.5l1-1-1-4-5 1z" />
    </S>
  ),
  Lightning: (p: IconProps) => (
    <S {...p}>
      <path d="M9 2L4 9h3l-1 5 5-7h-3z" />
    </S>
  ),
  Home: (p: IconProps) => (
    <S {...p}>
      <path d="M2 7.5L8 2l6 5.5V14H2z" />
      <path d="M6.5 14V9.5h3V14" />
    </S>
  ),
  MapPin: (p: IconProps) => (
    <S {...p}>
      <path d="M8 14s4.5-4.2 4.5-7.2a4.5 4.5 0 10-9 0C3.5 9.8 8 14 8 14z" />
      <circle cx="8" cy="6.8" r="1.5" />
    </S>
  ),
  Phone: (p: IconProps) => (
    <S {...p}>
      <path d="M5.2 2.5l1.2 2.7-1.3 1.1c.8 1.8 2.2 3.2 4 4l1.1-1.3 2.7 1.2-.4 2.4c-.1.6-.6 1-1.2 1C6.4 13.6 2.4 9.6 2.4 4.7c0-.6.4-1.1 1-1.2z" />
    </S>
  ),
  Message: (p: IconProps) => (
    <S {...p}>
      <path d="M2.5 3.5h11v7.5h-6L4 13.5V11H2.5z" />
      <path d="M5 6.5h6M5 8.5h4" />
    </S>
  ),
  Eye: (p: IconProps) => (
    <S {...p}>
      <path d="M1.5 8C3 5 5.5 3.5 8 3.5S13 5 14.5 8C13 11 10.5 12.5 8 12.5S3 11 1.5 8z" />
      <circle cx="8" cy="8" r="1.8" />
    </S>
  ),
  EyeOff: (p: IconProps) => (
    <S {...p}>
      <path d="M2 8c.6-1 1.5-2 2.6-2.7M14 8c-1.5 3-4 4.5-6 4.5-.7 0-1.4-.1-2-.4M6.5 4c.5-.1 1-.2 1.5-.2 2.5 0 5 1.5 6.5 4.2" />
      <path d="M2 2l12 12" />
    </S>
  ),
  Lock: (p: IconProps) => (
    <S {...p}>
      <rect x="3" y="7.5" width="10" height="6.5" rx="1" />
      <path d="M5 7.5V5.5a3 3 0 016 0v2" />
    </S>
  ),
  Search: (p: IconProps) => (
    <S {...p}>
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l4 4" />
    </S>
  ),
  Plus: (p: IconProps) => (
    <S {...p}>
      <path d="M8 3v10M3 8h10" />
    </S>
  ),
  Check: (p: IconProps) => (
    <S {...p}>
      <path d="M3 8.5l3 3 7-7" />
    </S>
  ),
  X: (p: IconProps) => (
    <S {...p}>
      <path d="M3 3l10 10M13 3L3 13" />
    </S>
  ),
  Edit: (p: IconProps) => (
    <S {...p}>
      <path d="M11.5 2.5l2 2-8 8L3 13l.5-2.5z" />
      <path d="M10 4l2 2" />
    </S>
  ),
  Chevron: (p: IconProps) => (
    <S {...p}>
      <path d="M5 4l4 4-4 4" />
    </S>
  ),
  ChevronDown: (p: IconProps) => (
    <S {...p}>
      <path d="M4 5l4 4 4-4" />
    </S>
  ),
  Arrow: (p: IconProps) => (
    <S {...p}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </S>
  ),
  Alert: (p: IconProps) => (
    <S {...p}>
      <path d="M8 2l6.5 11.5h-13z" />
      <path d="M8 7v3M8 12v.5" />
    </S>
  ),
  Info: (p: IconProps) => (
    <S {...p}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7v5M8 4.5v.5" />
    </S>
  ),
  Help: (p: IconProps) => (
    <S {...p}>
      <circle cx="8" cy="8" r="6" />
      <path d="M6.3 6.2a1.8 1.8 0 113 1.5c-.7.5-1.3.8-1.3 1.6M8 11.5v.4" />
    </S>
  ),
  Sparkle: (p: IconProps) => (
    <S {...p}>
      <path d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5z" />
    </S>
  ),
  Clock: (p: IconProps) => (
    <S {...p}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </S>
  ),
  Print: (p: IconProps) => (
    <S {...p}>
      <path d="M4 6V2.5h8V6" />
      <rect x="2.5" y="6" width="11" height="5.5" rx="1" />
      <rect x="4.5" y="9.5" width="7" height="4" />
    </S>
  ),
  Settings: (p: IconProps) => (
    <S {...p}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M3 8H1M15 8h-2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M3.6 12.4L5 11M11 5l1.4-1.4" />
    </S>
  ),
  Share: (p: IconProps) => (
    <S {...p}>
      <circle cx="12" cy="3.5" r="1.5" />
      <circle cx="12" cy="12.5" r="1.5" />
      <circle cx="4" cy="8" r="1.5" />
      <path d="M5.5 7.2l5-2.7M5.5 8.8l5 2.7" />
    </S>
  ),
  Image: (p: IconProps) => (
    <S {...p}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1.2" />
      <path d="M2.5 11.5l3-3 2.5 2.5 2.5-3 3 3.5" />
    </S>
  ),
  Package: (p: IconProps) => (
    <S {...p}>
      <path d="M2 5.5l6-3 6 3v7l-6 3-6-3z" />
      <path d="M8 2.5v10M2 5.5l6 3 6-3" />
      <path d="M5 4l6 3" />
    </S>
  ),
};
