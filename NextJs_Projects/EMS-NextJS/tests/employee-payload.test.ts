import { describe, expect, it } from 'vitest';
import { toEmployeePayload } from '@/lib/utils/employee-payload';
import { emptyEmployee } from '@/features/employees/employee-defaults';

const v = { ...emptyEmployee, firstName: ' Ann ', lastName: 'Lee', workEmail: 'ANN@X.IO', joiningDate: '2025-01-02' };
describe('toEmployeePayload', () => {
  it('create: omits empty optionals, trims and lower-cases the e-mail', () => {
    const p = toEmployeePayload(v, 'create', true);
    expect(p).toMatchObject({ firstName: 'Ann', workEmail: 'ann@x.io', joiningDate: '2025-01-02', workLocation: 'Office' });
    expect(p).not.toHaveProperty('phone'); expect(p).not.toHaveProperty('departmentId'); expect(p).not.toHaveProperty('account');
  });
  it('edit: emptied optionals become explicit null so they can be cleared — but never workLocation (backend 500s on null)', () => {
    const p = toEmployeePayload({ ...v, workLocation: '' }, 'edit', false);
    expect(p).toHaveProperty('phone', null); expect(p).toHaveProperty('departmentId', null);
    expect(p).not.toHaveProperty('workLocation');
  });
  it('compensation is only sent to those allowed to see it', () => {
    expect(toEmployeePayload({ ...v, salary: '5000', salaryCurrency: 'usd' }, 'create', true)).toMatchObject({ salary: 5000, salaryCurrency: 'USD' });
    expect(toEmployeePayload({ ...v, salary: '5000' }, 'create', false)).not.toHaveProperty('salary');
  });
  it('account block only when creating a login', () => {
    const p = toEmployeePayload({ ...v, createAccount: true, role: 'MANAGER', password: 'Str0ng!Passw0rd' }, 'create', false);
    expect(p.account).toEqual({ role: 'MANAGER', password: 'Str0ng!Passw0rd' });
    expect(toEmployeePayload({ ...v, createAccount: true, password: 'x' }, 'edit', false)).not.toHaveProperty('account');
  });
  it('maps the first emergency contact to the backend’s flat fields', () => {
    expect(toEmployeePayload({ ...v, emergencyContacts: [{ name: 'Z', phone: '+1 555 0100', relation: 'Sister' }] }, 'create', false)).toMatchObject({ emergencyContactName: 'Z', emergencyContactPhone: '+1 555 0100', emergencyContactRelation: 'Sister' });
  });
});
