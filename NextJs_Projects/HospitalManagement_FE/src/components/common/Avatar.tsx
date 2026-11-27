'use client';
import Image from 'next/image';
import { useState } from 'react';
import { avatarUrl } from '@/lib/utilities/format';
/** next/image + remotePatterns; degrades to initials if the image service is unreachable. */
export function Avatar({ name, size = 40, priority = false }: { name: string; size?: number; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = name.replace(/^Dr\.?\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  if (failed) return <span role="img" aria-label={name} style={{ width: size, height: size, fontSize: size / 2.6 }} className="inline-grid shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-fg">{initials}</span>;
  return <Image src={avatarUrl(name.replace(/^Dr\.?\s+/i, ''))} alt={name} width={size} height={size} quality={60} priority={priority} onError={() => setFailed(true)} className="shrink-0 rounded-full" />;
}
