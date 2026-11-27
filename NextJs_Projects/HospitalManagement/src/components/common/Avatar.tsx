'use client';
import Image from 'next/image';
import { useState } from 'react';
import { avatarUrl, initials } from '@/lib/utilities/format';

/**
 * Profile picture via next/image + remotePatterns (generated initials avatar). If the remote image service is unreachable or returns
 * nothing, the component degrades to a CSS initials badge (graceful image error handling). Privacy: only the person's name is sent.
 */
export function Avatar({ name, size = 40, priority = false }: { name: string; size?: number; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span aria-label={name} role="img" style={{ width: size, height: size, fontSize: size / 2.6 }} className="inline-grid shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-fg">{initials(name) || '?'}</span>;
  return <Image src={avatarUrl(name)} alt={name} width={size} height={size} quality={60} priority={priority} onError={() => setFailed(true)} className="shrink-0 rounded-full" />;
}
