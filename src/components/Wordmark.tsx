'use client';

import {useId} from 'react';

/**
 * Hanssimiko Bunker wordmark.
 *
 * Inline SVG rather than an image so the type stays crisp at any size and the
 * colours come from the same 0G palette as the rest of the interface.
 *
 * The stone-carved effect is built from three stacked SVG filters:
 *   1. a blurred copy behind the glyphs, for the soft purple glow
 *   2. a turbulence + displacement pass, for the uneven chiselled surface
 *   3. a composite that keeps only the thin dark cracks from that turbulence
 *
 * `feDisplacementMap` is deliberately capped at a low scale. Anything stronger
 * and the counters of the letters close up, which costs legibility — the
 * lettering has to survive being shrunk to 32px in the collapsed rail.
 *
 * There is no animation here on purpose: a logo should be still, and
 * `prefers-reduced-motion` should never need to be consulted for it.
 */

interface WordmarkProps {
  /** `stacked` is the two-line lockup; `compact` is a single small line. */
  variant?: 'stacked' | 'compact';
  className?: string;
}

const APP_NAME = 'Hanssimiko Bunker';

export function Wordmark({variant = 'stacked', className = ''}: WordmarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  if (variant === 'compact') {
    return (
      <svg
        viewBox="0 0 132 30"
        className={className}
        role="img"
        aria-label={APP_NAME}
        style={{height: '1.125rem', width: 'auto', display: 'block'}}
      >
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-4)" />
            <stop offset="100%" stopColor="var(--color-primary)" />
          </linearGradient>
        </defs>
        <text
          x="66"
          y="21"
          textAnchor="middle"
          style={{fontFamily: 'var(--font-display-cinzel)', fontWeight: 700}}
          fontSize="18"
          letterSpacing="1.2"
          fill={`url(#${uid}-fill)`}
        >
          BUNKER
        </text>
      </svg>
    );
  }

  const topGradient = `${uid}-fill`;
  const glow = `${uid}-glow`;
  const stone = `${uid}-stone`;

  return (
    <svg
      viewBox="0 0 200 66"
      className={className}
      role="img"
      aria-label={APP_NAME}
      style={{height: '3.25rem', width: 'auto', display: 'block', overflow: 'visible'}}
    >
      <defs>
        {/* Vertical gradient across the whole lockup: pale at the top, saturated
            purple at the bottom, straight from the official palette. */}
        <linearGradient id={topGradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary-4)" />
          <stop offset="55%" stopColor="var(--color-primary-2)" />
          <stop offset="100%" stopColor="var(--color-primary)" />
        </linearGradient>

        {/* Soft purple bloom behind the glyphs. */}
        <filter id={glow} x="-15%" y="-25%" width="130%" height="150%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feFlood floodColor="var(--color-primary)" floodOpacity="0.55" result="tint" />
          <feComposite in="tint" in2="blur" operator="in" />
        </filter>

        {/* Stone surface: turbulent displacement, then a composite that keeps
            only the dark fracture lines. Scale is held at 1.6 so the letterforms
            stay readable. */}
        <filter id={stone} x="-15%" y="-25%" width="130%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.6"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          {/* Darken only where the turbulence is dense, i.e. the cracks. */}
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0.07  0 0 0 0 0  0 0 0 0 0.17  0 0 0 -1.15 0.34"
            result="cracks"
          />
          <feComposite in="cracks" in2="displaced" operator="in" result="carved" />
          <feMerge>
            <feMergeNode in="displaced" />
            <feMergeNode in="carved" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow pass: the same text, blurred, sitting behind everything. */}
      <g filter={`url(#${glow})`} opacity="0.85">
        <text
          x="100"
          y="38"
          textAnchor="middle"
          style={{fontFamily: 'var(--font-display-gotisch)', fontWeight: 800}}
          fontSize="34"
          fill="var(--color-primary)"
        >
          Hanssimiko
        </text>
      </g>

      {/* Carved pass. */}
      <g filter={`url(#${stone})`}>
        {/* Dark stroke first, then the gradient fill on top: the stroke reads as
            the chiselled edge and the gradient as the polished face. */}
        <text
          x="100"
          y="38"
          textAnchor="middle"
          style={{fontFamily: 'var(--font-display-gotisch)', fontWeight: 800}}
          fontSize="34"
          stroke="#12002B"
          strokeWidth="1.5"
          fill={`url(#${topGradient})`}
          paintOrder="stroke"
        >
          Hanssimiko
        </text>

        <text
          x="100"
          y="58"
          textAnchor="middle"
          style={{fontFamily: 'var(--font-display-cinzel)', fontWeight: 700}}
          fontSize="15"
          letterSpacing="3.6"
          stroke="#12002B"
          strokeWidth="1.5"
          fill={`url(#${topGradient})`}
          paintOrder="stroke"
        >
          BUNKER
        </text>
      </g>

      {/* Top-edge highlight: a thin pale copy offset upward. */}
      <text
        x="100"
        y="37"
        textAnchor="middle"
        style={{fontFamily: 'var(--font-display-gotisch)', fontWeight: 800}}
        fontSize="34"
        fill="none"
        stroke="var(--color-primary-4)"
        strokeWidth="0.6"
        strokeOpacity="0.6"
      >
        Hanssimiko
      </text>
    </svg>
  );
}

export function Monogram({className = '', size = 40}: {className?: string; size?: number}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `${uid}-mono`;

  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={APP_NAME}
      style={{display: 'block', flexShrink: 0}}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary-4)" />
          <stop offset="100%" stopColor="var(--color-primary)" />
        </linearGradient>
      </defs>
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="9"
        fill="var(--monogram-bg, #0a0a0a)"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
      />
      {/* H above B reads more clearly than HB side by side at 16px. */}
      <text
        x="20"
        y="20"
        textAnchor="middle"
        style={{fontFamily: 'var(--font-display-gotisch)', fontWeight: 800}}
        fontSize="17"
        fill={`url(#${gradientId})`}
      >
        H
      </text>
      <text
        x="20"
        y="35"
        textAnchor="middle"
        style={{fontFamily: 'var(--font-display-cinzel)', fontWeight: 700}}
        fontSize="15"
        fill={`url(#${gradientId})`}
      >
        B
      </text>
    </svg>
  );
}

/** Picks the right lockup for the space available. */
function BrandMark() {
  return <Wordmark />;
}

export {BrandMark};
