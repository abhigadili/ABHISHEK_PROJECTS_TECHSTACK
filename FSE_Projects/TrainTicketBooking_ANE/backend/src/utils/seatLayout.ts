/** Berth / seat pattern per coach layout (configurable data lives in coach_types.berth_layout). */
const PATTERNS: Record<string, string[]> = {
  BERTH6: ['LOWER', 'MIDDLE', 'UPPER', 'LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'], // Sleeper / AC 3 Tier
  BERTH4: ['LOWER', 'UPPER', 'LOWER', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'], // AC 2 Tier
  BERTH2: ['LOWER', 'UPPER'], // AC First Class
  SEAT: ['WINDOW', 'MIDDLE_SEAT', 'AISLE', 'AISLE', 'MIDDLE_SEAT', 'WINDOW'], // Chair car / second sitting
};
export const seatTypeFor = (layout: string, index: number) => { const p = PATTERNS[layout] ?? PATTERNS.SEAT; return p[index % p.length]; };
export const SEAT_TYPES = [['LOWER', 'Lower berth'], ['MIDDLE', 'Middle berth'], ['UPPER', 'Upper berth'], ['SIDE_LOWER', 'Side lower'], ['SIDE_UPPER', 'Side upper'], ['WINDOW', 'Window seat'], ['MIDDLE_SEAT', 'Middle seat'], ['AISLE', 'Aisle seat']] as const;
