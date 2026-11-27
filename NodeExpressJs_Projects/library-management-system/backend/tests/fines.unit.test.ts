import { describe, expect, it } from 'vitest';
import { calculateOverdueFine, fineStatus } from '../src/lib/fines';
import { addDays, diffDays } from '../src/lib/dates';
import { validIsbn10, validIsbn13 } from '../src/lib/slug';
import { sniffImage } from '../src/lib/images';
import { PNG, JPEG, WEBP } from './helpers';

const base = { dueDate: '2026-03-10', finePerDay: 0.5, graceDays: 0, maxFinePerLoan: null as number | null };

describe('overdue fine calculation', () => {
  it('is zero when returned on or before the due date', () => {
    expect(calculateOverdueFine({ ...base, returnDate: '2026-03-10' }).amount).toBe(0);
    expect(calculateOverdueFine({ ...base, returnDate: '2026-03-01' })).toEqual({ daysOverdue: 0, chargeableDays: 0, amount: 0 });
  });
  it('charges per day late', () => {
    expect(calculateOverdueFine({ ...base, returnDate: '2026-03-14' })).toEqual({ daysOverdue: 4, chargeableDays: 4, amount: 2 });
  });
  it('honours the grace period', () => {
    const r = calculateOverdueFine({ ...base, graceDays: 3, returnDate: '2026-03-14' });
    expect(r).toEqual({ daysOverdue: 4, chargeableDays: 1, amount: 0.5 });
    expect(calculateOverdueFine({ ...base, graceDays: 3, returnDate: '2026-03-13' }).amount).toBe(0);
  });
  it('caps at the per-loan maximum', () => {
    expect(calculateOverdueFine({ ...base, maxFinePerLoan: 3, returnDate: '2026-04-30' }).amount).toBe(3);
  });
  it('rounds money to cents', () => {
    expect(calculateOverdueFine({ ...base, finePerDay: 0.33, returnDate: '2026-03-13' }).amount).toBe(0.99);
  });
});

describe('helpers', () => {
  it('computes fine status', () => {
    expect(fineStatus({ amount: 5, waived: 0, paid: 0 })).toBe('outstanding');
    expect(fineStatus({ amount: 5, waived: 0, paid: 2 })).toBe('partial');
    expect(fineStatus({ amount: 5, waived: 0, paid: 5 })).toBe('paid');
    expect(fineStatus({ amount: 5, waived: 5, paid: 0 })).toBe('waived');
    expect(fineStatus({ amount: 5, waived: 1, paid: 4 })).toBe('paid');
  });
  it('date maths', () => { expect(addDays('2026-02-27', 3)).toBe('2026-03-02'); expect(diffDays('2026-03-01', '2026-03-05')).toBe(4); });
  it('validates ISBN checksums', () => {
    expect(validIsbn13('9780132350884')).toBe(true); expect(validIsbn13('9780132350885')).toBe(false);
    expect(validIsbn10('0132350882')).toBe(true); expect(validIsbn10('0132350883')).toBe(false);
  });
  it('sniffs real image formats, not names', () => {
    expect(sniffImage(PNG)).toBe('image/png'); expect(sniffImage(JPEG)).toBe('image/jpeg'); expect(sniffImage(WEBP)).toBe('image/webp');
    expect(sniffImage(Buffer.from('<?php echo 1; ?> not an image at all'))).toBeNull();
  });
});
