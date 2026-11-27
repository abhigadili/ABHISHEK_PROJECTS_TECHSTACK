import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utilities/cn';
export const Table = ({ className, ...p }: HTMLAttributes<HTMLTableElement>) => <div className="w-full overflow-x-auto rounded-[var(--radius)] border border-line bg-surface"><table className={cn('w-full text-sm', className)} {...p} /></div>;
export const THead = (p: HTMLAttributes<HTMLTableSectionElement>) => <thead className="bg-surface2 text-left text-xs uppercase tracking-wide text-muted" {...p} />;
export const TBody = (p: HTMLAttributes<HTMLTableSectionElement>) => <tbody className="divide-y divide-line" {...p} />;
export const TR = ({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) => <tr className={cn('hover:bg-surface2/60', className)} {...p} />;
export const TH = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn('px-4 py-3 font-medium whitespace-nowrap', className)} {...p} />;
export const TD = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-4 py-3 align-middle', className)} {...p} />;
