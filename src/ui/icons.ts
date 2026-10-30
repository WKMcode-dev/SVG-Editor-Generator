const paths: Record<string, string> = {
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M6 10h12v11H6ZM12 14v3',
  unlock: 'M7 10V7a5 5 0 0 1 9-3M6 10h12v11H6ZM12 14v3',
  eye: 'M2 12s4-7 10-7s10 7 10 7s-4 7-10 7s-10-7-10-7ZM15 12a3 3 0 1 0-6 0a3 3 0 1 0 6 0',
  'eye-off':
    'M3 3L21 21M9 5c7-2 13 7 13 7s-1 3-5 5M6 6C3 8 2 12 2 12s4 7 10 7c2 0 3-.5 4-1M10 10a3 3 0 0 0 4 4',
};
export function iconMarkup(name: string, size = 15): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.eye}"/></svg>`;
}
