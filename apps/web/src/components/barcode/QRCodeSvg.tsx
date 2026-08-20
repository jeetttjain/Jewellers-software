import React from 'react';

interface QRCodeSvgProps {
  value: string;
  size?: number;
}

export const QRCodeSvg: React.FC<QRCodeSvgProps> = ({ value, size = 64 }) => {
  // Generate deterministic 15x15 micro QR matrix
  const gridSize = 15;
  const cellSize = size / gridSize;

  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 37 + value.charCodeAt(i)) % 999999;
  }

  const cells: boolean[][] = [];
  for (let r = 0; r < gridSize; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < gridSize; c++) {
      // Corner detection patterns (3 corners)
      const isTopLeft = r < 4 && c < 4;
      const isTopRight = r < 4 && c >= gridSize - 4;
      const isBottomLeft = r >= gridSize - 4 && c < 4;

      if (isTopLeft || isTopRight || isBottomLeft) {
        const isBorder = r === 0 || r === 3 || c === 0 || c === 3 ||
                         r === 0 || r === 3 || c === gridSize - 1 || c === gridSize - 4 ||
                         r === gridSize - 1 || r === gridSize - 4 || c === 0 || c === 3;
        const isCenter = (r >= 1 && r <= 2 && c >= 1 && c <= 2) ||
                         (r >= 1 && r <= 2 && c >= gridSize - 3 && c <= gridSize - 2) ||
                         (r >= gridSize - 3 && r <= gridSize - 2 && c >= 1 && c <= 2);
        row.push(isBorder || isCenter);
      } else {
        const val = ((hash + r * 13 + c * 29) % 5) < 3;
        row.push(val);
      }
    }
    cells.push(row);
  }

  return (
    <svg width={size} height={size} className="bg-white p-0.5 rounded border border-surface-200">
      {cells.map((row, rIdx) =>
        row.map((filled, cIdx) =>
          filled ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx * cellSize}
              y={rIdx * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#0F172A"
            />
          ) : null
        )
      )}
    </svg>
  );
};
