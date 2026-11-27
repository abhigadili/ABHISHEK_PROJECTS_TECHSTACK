'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { markAllReadAction, markReadAction } from './actions';
import { Button } from '@/components/ui/button';
/** Calls Server Actions from handlers inside a transition, then refreshes server data and the bell's query cache. */
export function MarkRead({ id }: { id: number }) { const [p, st] = useTransition(); const r = useRouter(); const q = useQueryClient(); return <Button size="sm" variant="ghost" loading={p} onClick={() => st(async () => { await markReadAction(id); await q.invalidateQueries({ queryKey: ['notifications'] }); r.refresh(); })}>Mark read</Button>; }
export function MarkAllRead() { const [p, st] = useTransition(); const r = useRouter(); const q = useQueryClient(); return <Button variant="outline" loading={p} onClick={() => st(async () => { await markAllReadAction(); await q.invalidateQueries({ queryKey: ['notifications'] }); r.refresh(); })}><CheckCheck className="size-4" />Mark all read</Button>; }
