function trimTrailingZeros(value: string): string {
  return value.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function truncateTowardZero(value: number): number {
  return value < 0 ? Math.ceil(value) : Math.floor(value);
}

export function formatCost(value: number): string {
  if (!Number.isFinite(value)) return '0';

  const abs = Math.abs(value);
  if (abs >= 10) {
    return String(truncateTowardZero(value));
  }
  if (abs >= 1) {
    return trimTrailingZeros(value.toFixed(1));
  }
  if (abs >= 0.1) {
    return trimTrailingZeros(value.toFixed(2));
  }
  return trimTrailingZeros(value.toFixed(3));
}
