import { initials } from './format';

const PALETTE = ['#1d76f1', '#0e9f6e', '#7e3af2', '#d03801', '#0694a2', '#c81e5b', '#5850ec', '#9f580a'];

/** Generates a small SVG avatar (data URI) from a name; rendered by <LazyAvatar> with loading="lazy". */
export function avatarDataUri(name: string, size = 96): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = PALETTE[h % PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" rx="${size / 2}" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="${size * 0.4}" fill="#fff" font-weight="600">${initials(name)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
