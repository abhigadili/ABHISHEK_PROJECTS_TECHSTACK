const pw = require('../../src/utils/password');
const { toCsv } = require('../../src/utils/csv');
const { sniff } = require('../../src/utils/imageType');
const { parseSort, parsePagination } = require('../../src/utils/pagination');
const dates = require('../../src/utils/dates');
const { toEmployee } = require('../../src/models/employeeMapper');

describe('password policy', () => {
  test.each([['short1!A', false], ['alllowercase1!', false], ['NOLOWERCASE1!', false], ['NoDigitsHere!!', false], ['NoSpecial12345', false], ['Str0ng-Passw0rd!', true]])('%s -> %s', (p, ok) => expect(pw.isStrong(p)).toBe(ok));
  test('hash/verify round-trip', async () => { const h = await pw.hash('Str0ng-Passw0rd!'); expect(h).not.toContain('Str0ng'); expect(await pw.verify('Str0ng-Passw0rd!', h)).toBe(true); expect(await pw.verify('x', h)).toBe(false); });
  test('sha256 is deterministic and 64 chars', () => { expect(pw.sha256('a')).toBe(pw.sha256('a')); expect(pw.sha256('a')).toHaveLength(64); });
});

describe('csv', () => {
  test('escapes quotes/commas and neutralises formulas', () => {
    const out = toCsv([{ a: 'x,"y"', b: '=SUM(A1)' }]);
    expect(out).toBe('a,b\n"x,""y""",\'=SUM(A1)');
  });
});

describe('image sniffing', () => {
  test('detects png, jpeg, webp, pdf; rejects text', () => {
    expect(sniff(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]))).toBe('image/png');
    expect(sniff(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(16)]))).toBe('image/jpeg');
    expect(sniff(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]))).toBe('image/webp');
    expect(sniff(Buffer.from('%PDF-1.7 abcdefg'))).toBe('application/pdf');
    expect(sniff(Buffer.from('<script>alert(1)</script>'))).toBeNull();
  });
});

describe('pagination & sorting', () => {
  test('clamps limit and page', () => { expect(parsePagination({ page: '-3', limit: '9999' })).toEqual({ page: 1, limit: 100, offset: 0 }); expect(parsePagination({ page: '3', limit: '10' }).offset).toBe(20); });
  test('sort only accepts whitelisted fields (no SQL injection)', () => {
    const allowed = { name: 'e.last_name' };
    expect(parseSort({ sort: 'name:desc' }, allowed, 'x')).toBe('e.last_name DESC');
    expect(parseSort({ sort: 'name; DROP TABLE employees' }, allowed, 'fallback')).toBe('fallback');
    expect(parseSort({ sort: '1=1' }, allowed, 'fallback')).toBe('fallback');
  });
});

describe('dates', () => {
  test('addDays / dayOfWeek / diffDays / monthRange', () => {
    expect(dates.addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(dates.dayOfWeek('2026-10-17')).toBe(6);
    expect(dates.diffDays('2026-01-01', '2026-01-31')).toBe(30);
    expect(dates.monthRange(2028, 2)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(dates.eachDate('2026-01-01', '2026-01-03')).toHaveLength(3);
  });
  test('sql utc round trip', () => { const d = new Date('2026-05-01T10:20:30Z'); expect(dates.fromSqlUtc(dates.toSqlUtc(d))).toBe('2026-05-01T10:20:30Z'); });
  test('localDate respects timezone', () => { const d = new Date('2026-01-01T23:30:00Z'); expect(dates.localDate(d, 'UTC')).toBe('2026-01-01'); expect(dates.localDate(d, 'Asia/Kolkata')).toBe('2026-01-02'); });
});

describe('employee field-level access', () => {
  const row = { id: 5, employee_code: 'E-5', first_name: 'A', last_name: 'B', work_email: 'a@b.c', salary: 100, salary_currency: 'USD', date_of_birth: '1990-01-01', personal_email: 'p@x.y', status: 'ACTIVE', user_id: 9, role: 'EMPLOYEE' };
  test('directory viewer gets no confidential data', () => { const e = toEmployee(row, { role: 'EMPLOYEE', employeeId: 7 }); expect(e.compensation).toBeUndefined(); expect(e.dateOfBirth).toBeUndefined(); expect(e.personalEmail).toBeUndefined(); expect(e.account).toBeUndefined(); });
  test('manager role alone does not unlock salary', () => { expect(toEmployee(row, { role: 'MANAGER', employeeId: 7 }).compensation).toBeUndefined(); });
  test('self sees personal data and own compensation but not account', () => { const e = toEmployee(row, { role: 'EMPLOYEE', employeeId: 5 }); expect(e.compensation.salary).toBe(100); expect(e.account).toBeUndefined(); });
  test('HR sees everything', () => { const e = toEmployee(row, { role: 'HR_ADMIN', employeeId: 1 }); expect(e.compensation.salary).toBe(100); expect(e.account.role).toBe('EMPLOYEE'); });
});
