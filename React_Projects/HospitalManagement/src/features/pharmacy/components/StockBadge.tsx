import { Badge } from '@/components/ui/badge';
import type { StockLevel } from '@/types';

const MAP: Record<StockLevel, { v: 'success' | 'warning' | 'danger'; l: string }> = { OK: { v: 'success', l: 'In stock' }, LOW: { v: 'warning', l: 'Low stock' }, OUT: { v: 'danger', l: 'Out of stock' } };
export const StockBadge = ({ level }: { level: StockLevel }) => <Badge variant={MAP[level].v}>{MAP[level].l}</Badge>;
