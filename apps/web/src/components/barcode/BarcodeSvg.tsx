import React from 'react';

interface BarcodeSvgProps {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  width = 160,
  height = 40,
  showText = true
}) => {
  // Deterministic barcode pattern generation for Code 128 visual simulation
  const bars: boolean[] = [];
  let seed = 0;
  for (let i = 0; i < value.length; i++) {
    seed = (seed * 31 + value.charCodeAt(i)) % 100000;
  }

  // Guard bars
  bars.push(true, false, true);
  for (let i = 0; i < 35; i++) {
    const isBar = (seed + i * 17) % 3 !== 0;
    bars.push(isBar);
  }
  bars.push(true, false, true, true);

  const barWidth = width / bars.length;

  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={height} className="overflow-visible">
        {bars.map((isBar, idx) =>
          isBar ? (
            <rect
              key={idx}
              x={idx * barWidth}
              y={0}
              width={barWidth * 0.9}
              height={height}
              fill="#0F172A"
            />
          ) : null
        )}
      </svg>
      {showText && (
        <span className="font-mono text-[10px] font-bold text-surface-900 tracking-wider mt-0.5">
          {value}
        </span>
      )}
    </div>
  );
};
