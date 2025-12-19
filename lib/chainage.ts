import { ChainagePoint } from './types';

/**
 * Parse chainage string (e.g. "0+000") to meters
 */
export function parseChainage(chainage: string): number {
  const parts = chainage.split('+');
  if (parts.length !== 2) return 0;
  const km = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  return km * 1000 + m;
}

/**
 * Format meters to chainage string (e.g. 100 -> "0+100", 1050 -> "1+050")
 */
export function formatChainage(meters: number): string {
  const km = Math.floor(meters / 1000);
  const m = meters % 1000;
  return `${km}+${String(m).padStart(3, '0')}`;
}

/**
 * Generate chainage points for a range
 * Supports custom point patterns (labels) or pointsPerChainage fallback
 */
export function generateChainagePoints(
  fromChainage: string,
  toChainage: string,
  pointsPerChainage: number,
  interval: number = 20, // Default 20m interval
  pointPattern?: string[]
): ChainagePoint[] {
  const fromM = parseChainage(fromChainage);
  const toM = parseChainage(toChainage);
  const points: ChainagePoint[] = [];

  // Calculate offset for side points
  // If pointsPerChainage is 3, we have left (-offset), center (0), right (+offset)
  // Default offset is 3.5m, but can be calculated based on pointsPerChainage
  const offset = pointsPerChainage > 1 ? 3.5 : 0;

  for (let m = fromM; m <= toM; m += interval) {
    const chainageStr = formatChainage(m);

    if (pointPattern && pointPattern.length > 0) {
      pointPattern.forEach((rawLabel) => {
        const label = rawLabel.trim();
        const upper = label.toUpperCase();
        const isCL = upper === 'CL' || upper.endsWith(' CL');
        const isRD = upper.startsWith('RD');
        const isLHS = upper.includes('LHS');
        const isRHS = upper.includes('RHS');
        points.push({
          chainage: chainageStr,
          offset: 0,
          displayName: isCL ? `${chainageStr} CL` : label,
          chainageType: isCL ? 'CL' : isRD ? 'RD' : isLHS ? 'LHS' : isRHS ? 'RHS' : undefined,
        });
      });
    } else if (pointsPerChainage === 1) {
      // Only center point
      points.push({
        chainage: chainageStr,
        offset: 0,
        displayName: chainageStr,
      });
    } else if (pointsPerChainage === 3) {
      // Left, center, right - format: "3.5 LHS", "2+460 CL", "3.5 RHS"
      points.push({
        chainage: chainageStr,
        offset: -offset,
        displayName: `${offset} LHS`,
        chainageType: 'LHS',
      });
      points.push({
        chainage: chainageStr,
        offset: 0,
        displayName: `${chainageStr} CL`,
        chainageType: 'CL',
      });
      points.push({
        chainage: chainageStr,
        offset: offset,
        displayName: `${offset} RHS`,
        chainageType: 'RHS',
      });
    } else {
      // For other numbers, create evenly spaced points
      const spacing = offset * 2 / (pointsPerChainage - 1);
      for (let i = 0; i < pointsPerChainage; i++) {
        const pointOffset = -offset + (i * spacing);
        points.push({
          chainage: chainageStr,
          offset: pointOffset,
          displayName: pointOffset === 0 ? chainageStr : String(Math.abs(pointOffset)),
        });
      }
    }
  }

  return points;
}

