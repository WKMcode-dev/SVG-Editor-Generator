const paths: Record<string, string> = {
  grip: 'M8 4h1M15 4h1M8 12h1M15 12h1M8 20h1M15 20h1',
  link: 'M10 13a5 5 0 0 0 7 .4l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.4l-3 3a5 5 0 0 0 7 7l2-2',
  unlink:
    'M3 3L21 21M10 6l3-3a5 5 0 0 1 7 7l-2 2M6 10l-3 3a5 5 0 0 0 7 7l2-2M8 3V1M3 8H1M16 21v2M21 16h2',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M6 10h12v11H6ZM12 14v3',
  unlock: 'M7 10V7a5 5 0 0 1 9-3M6 10h12v11H6ZM12 14v3',
  eye: 'M2 12s4-7 10-7s10 7 10 7s-4 7-10 7s-10-7-10-7ZM15 12a3 3 0 1 0-6 0a3 3 0 1 0 6 0',
  'eye-off':
    'M3 3L21 21M9 5c7-2 13 7 13 7s-1 3-5 5M6 6C3 8 2 12 2 12s4 7 10 7c2 0 3-.5 4-1M10 10a3 3 0 0 0 4 4',
};
export function iconMarkup(name: string, size = 15): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.eye}"/></svg>`;
}
