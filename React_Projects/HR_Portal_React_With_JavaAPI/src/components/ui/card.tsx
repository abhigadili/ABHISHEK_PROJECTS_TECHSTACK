import * as React from 'react';
import { cn } from '@/utils/cn';
import { useUi, trNode } from '@/hooks/useUi';
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('hr-card', className)} {...p} />;
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('flex items-center justify-between gap-3 px-4 pt-4', className)} {...p} />;
export const CardTitle = ({ className, children, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => { useUi(); return <h3 className={cn('m-0 text-[15px] font-semibold', className)} {...p}>{Array.isArray(children) ? children.map((c, i) => <React.Fragment key={i}>{trNode(c)}</React.Fragment>) : trNode(children)}</h3>; };
export const CardBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('p-4', className)} {...p} />;
