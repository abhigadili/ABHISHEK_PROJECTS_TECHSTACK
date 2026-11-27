import Image from 'next/image';
import { initials } from '@/lib/utils/format';

/**
 * Employee picture via next/image. Pictures are PRIVATE: they come from the authenticated route handler /api/employees/[id]/picture
 * (needs the session cookie, `Cache-Control: private`). `unoptimized` is deliberate — Next's public image optimizer would fetch the
 * URL without the user's cookies and could cache a private image in a shared cache. Explicit width/height still prevent layout shift,
 * and `loading="lazy"` (default) defers off-screen images. Public assets (hero, logo) DO go through the optimizer.
 */
export function Avatar({ employeeId, name, hasPicture, size = 40 }: { employeeId: number; name: string; hasPicture: boolean; size?: number }) {
  if (!hasPicture) {
    return (
      <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground" style={{ width: size, height: size, fontSize: size * 0.38 }}>
        {initials(name)}
      </span>
    );
  }
  return <Image src={`/api/employees/${employeeId}/picture`} alt={`Photo of ${name}`} width={size} height={size} unoptimized className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
}
