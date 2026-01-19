import React from 'react';

type Props = {
  /** Optional override if you already have a theme token */
  arrowColor?: string;
  /** Optional override for spacing */
  marginY?: number;
};

export function StepConnectorDown({
  arrowColor = 'rgba(255, 122, 106, 0.95)',
  marginY = 8,
}: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: `${marginY}px 0` }} aria-hidden="true">
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.9,
        }}
      >
        <span
          style={{
            color: arrowColor,
            fontSize: 16,
            lineHeight: '16px',
            fontWeight: 800,
            transform: 'translateY(-1px)',
            userSelect: 'none',
          }}
        >
          ↓
        </span>
      </div>
    </div>
  );
}
