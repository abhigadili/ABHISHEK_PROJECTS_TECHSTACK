import type { Medicine, StockLevel } from '@/types';

export const stockLevel = (m: Medicine): StockLevel => (m.stockQuantity <= 0 ? 'OUT' : m.stockQuantity <= m.reorderLevel ? 'LOW' : 'OK');
