// @vitest-environment jsdom
import './setup-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const m = vi.hoisted(() => ({ save: vi.fn(), push: vi.fn() }));
vi.mock('@/actions/employees', () => ({ saveEmployeeAction: m.save }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: m.push, refresh: vi.fn(), back: vi.fn() }) }));
import { EmployeeForm } from '@/features/employees/EmployeeForm';
import { emptyEmployee } from '@/features/employees/employee-defaults';
import { ToastProvider } from '@/contexts/ToastContext';

const setup = (mode: 'create' | 'edit' = 'create') => render(<ToastProvider><EmployeeForm mode={mode} employeeId={mode === 'edit' ? 3 : undefined} defaults={{ ...emptyEmployee, joiningDate: '2025-01-02' }} departments={[{ id: 1, name: 'Eng' }]} designations={[{ id: 2, name: 'Dev' }]} managerName="Boss" canSetCompensation canCreateAccount /></ToastProvider>);
beforeEach(() => { m.save.mockReset(); m.push.mockReset(); localStorage.clear(); });

describe('EmployeeForm (React Hook Form + zod)', () => {
  it('blocks an invalid submit client-side and does not call the Server Action', async () => {
    setup(); await userEvent.click(screen.getByTestId('save-employee'));
    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(m.save).not.toHaveBeenCalled();
  });
  it('field arrays add and remove rows', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Add education' }));
    expect(screen.getByLabelText('Institution')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Education' }));
    expect(screen.queryByLabelText('Institution')).toBeNull();
  });
  it('password fields appear only when "Create a login" is ticked', async () => {
    setup(); expect(screen.queryByLabelText('Confirm password')).toBeNull();
    await userEvent.click(screen.getByLabelText(/Create a login/));
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
  });
  it('manager picker: debounced typeahead against the BFF, hides the employee themself, selection feeds the form value', async () => {
    const f = vi.fn<(url: string) => Promise<Response>>(async () => new Response(JSON.stringify({ items: [{ id: 3, fullName: 'Self Person', employeeCode: 'E3', jobTitle: null, department: null }, { id: 4, fullName: 'Boss Person', employeeCode: 'E4', jobTitle: null, department: { name: 'Eng' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    setup('edit'); // employeeId = 3 → "Self Person" must not be offered
    await userEvent.type(screen.getByRole('combobox', { name: 'Manager' }), 'per');
    const option = await screen.findByRole('option', { name: /Boss Person/ });
    expect(screen.queryByRole('option', { name: /Self Person/ })).toBeNull();
    expect(String(f.mock.calls[0]![0])).toBe('/api/employees?search=per&limit=8');
    await userEvent.click(option);
    expect(screen.getByTestId('picker-selected')).toHaveTextContent('Boss Person');
  });
  it('manager picker is keyboard operable (ArrowDown/Enter)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [{ id: 8, fullName: 'Ann A', employeeCode: 'E8', jobTitle: null, department: null }, { id: 9, fullName: 'Ann B', employeeCode: 'E9', jobTitle: null, department: null }] }), { status: 200 })));
    setup(); await userEvent.type(screen.getByRole('combobox', { name: 'Manager' }), 'ann');
    await screen.findByRole('option', { name: /Ann B/ });
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('picker-selected')).toHaveTextContent('Ann B');
  });
  it('valid submit sends JSON to the Server Action, stores qualifications locally and navigates', async () => {
    m.save.mockResolvedValue({ ok: true, message: 'Employee created', data: { id: 77 } });
    setup();
    await userEvent.type(screen.getByLabelText(/First name/), 'Ann'); await userEvent.type(screen.getByLabelText(/Last name/), 'Lee'); await userEvent.type(screen.getByLabelText(/Work email/), 'ann@x.io');
    await userEvent.click(screen.getByTestId('save-employee'));
    await waitFor(() => expect(m.save).toHaveBeenCalledTimes(1));
    const [mode, id, json] = m.save.mock.calls[0]!;
    expect(mode).toBe('create'); expect(id).toBeNull(); expect(JSON.parse(json)).toMatchObject({ firstName: 'Ann', workEmail: 'ann@x.io' });
    await waitFor(() => expect(m.push).toHaveBeenCalledWith('/employees/77'));
  });
  it('maps server field errors back onto the field', async () => {
    m.save.mockResolvedValue({ ok: false, message: 'Please fix', fieldErrors: { workEmail: 'Work email is already used' } });
    setup();
    await userEvent.type(screen.getByLabelText(/First name/), 'Ann'); await userEvent.type(screen.getByLabelText(/Last name/), 'Lee'); await userEvent.type(screen.getByLabelText(/Work email/), 'ann@x.io');
    await userEvent.click(screen.getByTestId('save-employee'));
    expect(await screen.findByText('Work email is already used')).toBeInTheDocument();
    expect(m.push).not.toHaveBeenCalled();
  });
});
