export function formatBDT(amount: number): string {
  const rounded = Math.round(amount);
  return `৳${rounded.toLocaleString('en-US')}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}
