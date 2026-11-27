import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
/** shadcn-style table primitives (server-component friendly). */
export const Table = ({ className, ...p }: HTMLAttributes<HTMLTableElement>) => <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className={cn('w-full text-sm', className)} {...p} /></div>;
export const THead = ({ className, ...p }: HTMLAttributes<HTMLTableSectionElement>) => <thead className={cn('bg-slate-50 text-left text-slate-500 dark:bg-slate-800', className)} {...p} />;
export const TBody = (p: HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} />;
export const TR = ({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) => <tr className={cn('border-t border-slate-100 dark:border-slate-800', className)} {...p} />;
export const TH = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn('px-4 py-2 font-medium', className)} {...p} />;
export const TD = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-4 py-2.5', className)} {...p} />;
