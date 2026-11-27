import { ImageResponse } from 'next/og';

/** File-convention icon generated at build time (served as /icon). A static icon.png would work the same way. */
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';
export default function Icon() {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1d4ed8', color: '#fff', fontSize: 40, fontWeight: 800, borderRadius: 14 }}>E</div>, size);
}
