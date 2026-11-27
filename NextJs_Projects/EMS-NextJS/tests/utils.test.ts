import { describe, expect, it } from 'vitest';
import { formatDate, formatHours, formatMoney, formatTime, humanize, initials, toId } from '@/lib/utils/format';
import { int, one, withParams } from '@/lib/utils/search-params';
import { safeNext } from '@/lib/utils/safe-redirect';
import { cn } from '@/lib/utils/cn';

describe('format', () => {
  it('formats dates in UTC so server and browser agree (no hydration drift)', () => {
    expect(formatDate('2026-03-01')).toBe(formatDate('2026-03-01T00:00:00Z'));
    expect(formatDate(null)).toBe('—');
  });
  it('humanizes enum values and builds initials', () => {
    expect(humanize('FULL_TIME')).toBe('Full Time');
    expect(initials('ella brooks mary')).toBe('EB');
  });
  it('formats hours, money, times and ids defensively', () => {
    expect(formatHours(7.456)).toBe('7.5 h');
    expect(formatHours(null)).toBe('—');
    expect(formatMoney(1000, 'USD')).toContain('1,000');
    expect(formatTime(null)).toBe('—');
    expect(toId('12')).toBe(12);
    expect(toId('12abc')).toBeUndefined();
  });
});

describe('search-params', () => {
  it('one() takes the first of repeated values and drops empties', () => {
    expect(one(['a', 'b'])).toBe('a');
    expect(one('')).toBeUndefined();
  });
  it('int() clamps and falls back on garbage', () => {
    expect(int('5', 1)).toBe(5);
    expect(int('-3', 1)).toBe(1);
    expect(int('abc', 7)).toBe(7);
    expect(int('99999', 1, 1, 100)).toBe(100);
    expect(int('1.5', 4)).toBe(4);
  });
  it('withParams() keeps filters, overrides some, removes empties', () => {
    expect(withParams('/employees', { search: 'ann', page: '3' }, { page: 4 })).toBe('/employees?search=ann&page=4');
    expect(withParams('/employees', { search: 'ann' }, { search: '' })).toBe('/employees');
  });
});

describe('safeNext (open-redirect protection)', () => {
  it.each([['/employees?page=2', '/employees?page=2'], ['https://evil.example', '/dashboard'], ['//evil.example', '/dashboard'], ['/\\evil', '/dashboard'], [null, '/dashboard'], ['employees', '/dashboard']])('%s → %s', (input, out) => {
    expect(safeNext(input as string | null)).toBe(out);
  });
});

describe('cn', () => { it('joins and drops falsy', () => { expect(cn('a', false, undefined, 'b')).toBe('a b'); }); });
