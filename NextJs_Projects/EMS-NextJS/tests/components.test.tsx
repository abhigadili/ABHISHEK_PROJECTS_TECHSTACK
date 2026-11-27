// @vitest-environment jsdom
import './setup-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionForm, Field, SubmitButton } from '@/components/forms/ActionForm';
import { ToastProvider, toastReducer } from '@/contexts/ToastContext';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { ConfirmSubmit } from '@/components/dialogs/ConfirmSubmit';
import { Avatar } from '@/components/common/Avatar';
import type { ActionState } from '@/types/actions';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));
// eslint-disable-next-line @next/next/no-img-element -- test double for next/image
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} /> }));

const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

describe('ActionForm + Field (Server Action form state)', () => {
  it('shows the server message and per-field errors, and echoes the submitted value back', async () => {
    const action = vi.fn(async (_p: ActionState, fd: FormData): Promise<ActionState> => ({ ok: false, message: 'Please fix the highlighted fields.', fieldErrors: { name: 'Name is required' }, values: { name: String(fd.get('name')) } }));
    wrap(<ActionForm action={action}><Field name="name" label="Name" /><SubmitButton>Save</SubmitButton></ActionForm>);
    await userEvent.type(screen.getByLabelText('Name'), 'x{Backspace}');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Please fix the highlighted fields.')).toBeInTheDocument();
    const input = screen.getByLabelText('Name');
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('Name is required').id);
  });
  it('disables the submit button while the action is pending (no double submit)', async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<ActionState>((r) => { finish = () => r({ ok: true, message: 'Saved' }); }));
    wrap(<ActionForm action={action}><Field name="a" label="A" /><SubmitButton pendingLabel="Saving…">Save</SubmitButton></ActionForm>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const busy = await screen.findByRole('button', { name: 'Saving…' });
    expect(busy).toBeDisabled(); expect(busy).toHaveAttribute('aria-busy', 'true');
    finish();
    expect(await screen.findByText('Saved')).toBeInTheDocument(); // success → toast
    expect(action).toHaveBeenCalledTimes(1);
  });
  it('labels are programmatically tied to inputs (useId)', () => { wrap(<ActionForm action={async () => ({})}><Field name="e" label="Email" required /></ActionForm>); expect(screen.getByLabelText(/Email/)).toBeInTheDocument(); });
});

describe('toastReducer', () => {
  it('pushes and dismisses', () => {
    const a = toastReducer([], { type: 'push', toast: { id: 1, kind: 'info', message: 'hi' } });
    expect(a).toHaveLength(1); expect(toastReducer(a, { type: 'dismiss', id: 1 })).toHaveLength(0);
  });
});

describe('DataTable', () => {
  it('renders typed rows, a caption for assistive tech and hides low-priority columns responsively', () => {
    render(<DataTable rows={[{ id: 1, n: 'Ann' }, { id: 2, n: 'Bo' }]} rowKey={(r) => r.id} caption="People" columns={[{ key: 'n', header: 'Name', render: (r) => r.n }, { key: 'i', header: 'Id', hideBelow: 'md', render: (r) => r.id }]} />);
    expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('columnheader', { name: 'Id' }).className).toContain('md:table-cell');
  });
});

describe('Pagination', () => {
  it('keeps the active filters in prev/next links and disables the ends', () => {
    render(<Pagination base="/employees" meta={{ page: 2, limit: 10, total: 35, totalPages: 4 }} params={{ search: 'ann', page: '2' }} />);
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/employees?search=ann&page=3');
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/employees?search=ann&page=1');
    expect(screen.getByText(/Page 2 of 4/)).toBeInTheDocument();
  });
  it('renders only a result count for a single page', () => { render(<Pagination base="/x" meta={{ page: 1, limit: 10, total: 3, totalPages: 1 }} params={{}} />); expect(screen.queryByRole('navigation')).toBeNull(); expect(screen.getByText('3 results')).toBeInTheDocument(); });
});

describe('ConfirmSubmit (destructive confirmation)', () => {
  it('submits the surrounding form only after the user confirms', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<form onSubmit={onSubmit}><ConfirmSubmit title="Delete?" message="Really?" confirmLabel="Yes, delete">Delete</ConfirmSubmit></form>);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('dialog', { name: 'Delete?' })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
  it('Cancel / Escape close without submitting', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<form onSubmit={onSubmit}><ConfirmSubmit title="Delete?" message="Really?">Delete</ConfirmSubmit></form>);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('Avatar', () => {
  it('private pictures come from the authenticated route handler; no picture → initials', () => {
    const { rerender } = render(<Avatar employeeId={7} name="Ann Lee" hasPicture />);
    expect(screen.getByRole('img', { name: 'Photo of Ann Lee' })).toHaveAttribute('src', '/api/employees/7/picture');
    rerender(<Avatar employeeId={7} name="Ann Lee" hasPicture={false} />);
    expect(screen.getByText('AL')).toBeInTheDocument();
  });
});
