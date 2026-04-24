/**
 * SF-Symbol-flavoured icons for age-rating section headers. Each mirrors the
 * `systemName` used in the SwiftUI source — gearshape, globe, exclamationmark
 * triangle, etc. — rendered as minimal inline SVG so they inherit the blue
 * tint `SectionHeader` sets via `color`.
 */

function base(children: React.ReactNode) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const GearIcon = () => base(
  <>
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" />
  </>,
);

export const GlobeIcon = () => base(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M2 8h12M8 2c2 2 2.8 4.2 2.8 6S10 12 8 14c-2-2-2.8-4.2-2.8-6S6 4 8 2z" />
  </>,
);

export const QuestionIcon = () => base(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M6.3 6.2c0-.9.8-1.6 1.7-1.6s1.7.7 1.7 1.6c0 .9-1.7 1.3-1.7 2.3" />
    <circle cx="8" cy="11.2" r=".5" fill="currentColor" />
  </>,
);

export const MedicalIcon = () => base(
  <>
    <rect x="3" y="4" width="10" height="9" rx="1" />
    <path d="M8 6.5v4.5M5.8 8.8h4.5" />
  </>,
);

export const CheckmarkCircleIcon = () => base(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M5.5 8.2l1.8 1.8 3.2-3.8" />
  </>,
);

export const HeartIcon = () => base(
  <path d="M8 13.3s-5-2.9-5-6.6a2.9 2.9 0 0 1 5-2 2.9 2.9 0 0 1 5 2c0 3.7-5 6.6-5 6.6z" />,
);

export const WarningTriangleIcon = () => base(
  <>
    <path d="M8 2.5 14 13H2L8 2.5z" />
    <path d="M8 6.8v3M8 11.5h.01" />
  </>,
);

export const DiceIcon = () => base(
  <>
    <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
    <circle cx="5.5" cy="5.5" r=".7" fill="currentColor" />
    <circle cx="10.5" cy="10.5" r=".7" fill="currentColor" />
    <circle cx="8" cy="8" r=".7" fill="currentColor" />
  </>,
);

export const StarCircleIcon = () => base(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="m8 4.7 1 2 2.3.3-1.7 1.6.5 2.2L8 9.8l-2.1 1 .5-2.2L4.7 7l2.3-.3 1-2z" />
  </>,
);

export const PersonCheckIcon = () => base(
  <>
    <circle cx="7" cy="5.5" r="2" />
    <path d="M2.8 13c0-2.3 1.9-4.1 4.2-4.1 1 0 2 .4 2.7 1" />
    <path d="M10.2 11.6l1.3 1.3 2.2-2.5" />
  </>,
);

export const LinkIcon = () => base(
  <>
    <path d="M6.5 9.5a2.2 2.2 0 0 0 3.1 0l2.2-2.2a2.2 2.2 0 0 0-3.1-3.1l-.8.8" />
    <path d="M9.5 6.5a2.2 2.2 0 0 0-3.1 0L4.2 8.7a2.2 2.2 0 0 0 3.1 3.1l.8-.8" />
  </>,
);
