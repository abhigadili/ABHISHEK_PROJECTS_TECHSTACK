import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './common/ErrorBoundary';
import { DataTable, type Column } from './tables/DataTable';
import { ConfirmProvider, useConfirm } from './dialogs/ConfirmDialog';
import { FileUpload, type FileUploadHandle } from './common/FileUpload';
import { VirtualList } from './common/VirtualList';
import { Can } from './common/Can';
import { StatusBadge } from './common/StatusBadge';
import { EmployeeCard } from './common/EmployeeCard';
import { ErrorMessage, EmptyState } from './common/Feedback';
import { SearchBox } from './tables/SearchBox';
import { renderWithProviders } from '@/test/utils';
import { employee } from '@/test/fixtures';
import { toCsv } from '@/utils/csv';
import { formatDate, parseDate, parseTimestamp, toIsoDate, humanize, initials } from '@/utils/format';

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('kaboom');
  return <p>fine</p>;
}

describe('ErrorBoundary', () => {
  it('renders children normally', () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('catches a render error, shows the fallback, logs and reports it', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('kaboom');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'kaboom' }),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('recovers when the user presses "Try again" and the problem is gone', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Harness() {
      const [explode, setExplode] = useState(true);
      return (
        <>
          <button onClick={() => setExplode(false)}>fix</button>
          <ErrorBoundary>
            <Bomb explode={explode} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByText('fix'));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('fine')).toBeInTheDocument();
    log.mockRestore();
  });

  it('resets automatically when a resetKey changes (e.g. route navigation)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Harness() {
      const [path, setPath] = useState('/a');
      return (
        <>
          <button onClick={() => setPath('/b')}>go</button>
          <ErrorBoundary resetKeys={[path]}>
            <Bomb explode={path === '/a'} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByText('go'));
    expect(screen.getByText('fine')).toBeInTheDocument();
    log.mockRestore();
  });

  it('supports a custom fallback with a reset callback', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary fallback={(e, reset) => <button onClick={reset}>custom: {e.message}</button>}>
        <Bomb explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: 'custom: kaboom' })).toBeInTheDocument();
    log.mockRestore();
  });

  it('does NOT catch errors thrown in event handlers (that is try/catch territory)', async () => {
    const onWindowError = vi.fn((e: ErrorEvent) => e.preventDefault());
    window.addEventListener('error', onWindowError);
    render(
      <ErrorBoundary>
        <button
          onClick={() => {
            throw new Error('in handler');
          }}
        >
          click
        </button>
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByText('click'));
    expect(screen.queryByRole('alert')).toBeNull();
    window.removeEventListener('error', onWindowError);
  });
});

interface Row {
  id: number;
  name: string;
  age: number;
}
const rows: Row[] = [
  { id: 1, name: 'Ann', age: 30 },
  { id: 2, name: 'Ben', age: 40 },
];
const cols: Column<Row>[] = [
  { key: 'name', header: 'Name', sortKey: 'name' },
  { key: 'age', header: 'Age', render: (r) => `${r.age} yrs` },
];

describe('DataTable', () => {
  it('renders headers and typed cells (default + custom render)', () => {
    render(<DataTable<Row> columns={cols} rows={rows} getRowId={(r) => r.id} caption="people" />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('Ann')).toBeInTheDocument();
    expect(screen.getByText('40 yrs')).toBeInTheDocument();
  });
  it('sorting and row click call back', async () => {
    const onSort = vi.fn();
    const onRowClick = vi.fn();
    render(
      <DataTable<Row>
        columns={cols}
        rows={rows}
        getRowId={(r) => r.id}
        onSort={onSort}
        sort={{ field: 'name', dir: 'asc' }}
        onRowClick={onRowClick}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSort).toHaveBeenCalledWith('name');
    await userEvent.click(screen.getByText('Ben'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });
  it('pagination reports 1-based pages', async () => {
    const onPage = vi.fn();
    render(
      <DataTable<Row>
        columns={cols}
        rows={rows}
        getRowId={(r) => r.id}
        pagination={{ page: 1, limit: 10, total: 25, onPage }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
  it('empty state, skeleton and error + retry', async () => {
    const { rerender } = render(
      <DataTable<Row> columns={cols} rows={[]} getRowId={(r) => r.id} emptyTitle="Nothing" />,
    );
    expect(screen.getByText('Nothing')).toBeInTheDocument();
    rerender(<DataTable<Row> columns={cols} rows={[]} getRowId={(r) => r.id} loading />);
    expect(screen.queryByText('Nothing')).toBeNull();
    const retry = vi.fn();
    rerender(<DataTable<Row> columns={cols} rows={[]} getRowId={(r) => r.id} error="Boom" onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalled();
  });
  it('row selection checkboxes', async () => {
    const onToggle = vi.fn();
    render(
      <DataTable<Row>
        columns={cols}
        rows={rows}
        getRowId={(r) => r.id}
        selectedIds={[1]}
        onToggleRow={onToggle}
      />,
    );
    expect(screen.getByLabelText('Select row 1')).toBeChecked();
    await userEvent.click(screen.getByLabelText('Select row 2'));
    expect(onToggle).toHaveBeenCalledWith(2);
  });
});

describe('ConfirmProvider (promise-based dialog)', () => {
  function Harness({ onResult }: { onResult: (v: boolean) => void }) {
    const confirm = useConfirm();
    return (
      <button
        onClick={async () =>
          onResult(
            await confirm({
              title: 'Delete it?',
              message: 'Really?',
              confirmLabel: 'Yes, delete',
              destructive: true,
            }),
          )
        }
      >
        ask
      </button>
    );
  }
  it.each([
    ['Yes, delete', true],
    ['Cancel', false],
  ])('resolves %s → %s', async (button, expected) => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Harness onResult={onResult} />
      </ConfirmProvider>,
    );
    await userEvent.click(screen.getByText('ask'));
    expect(await screen.findByRole('dialog', { name: 'Delete it?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: button }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(expected));
  });
  it('useConfirm outside the provider throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Harness onResult={() => undefined} />)).toThrow(/ConfirmProvider/);
    spy.mockRestore();
  });
});

describe('FileUpload (refs + forwardRef + useImperativeHandle)', () => {
  const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });
  it('accepts an allowed file and forwards it', async () => {
    const onFile = vi.fn();
    render(<FileUpload accept="image/png,image/jpeg" maxBytes={1000} onFile={onFile} />);
    await userEvent.upload(screen.getByTestId('file-input'), file('a.png', 'image/png'));
    expect(onFile).toHaveBeenCalledTimes(1);
  });
  it('rejects a wrong type and an oversized file (client-side courtesy check)', async () => {
    const onFile = vi.fn();
    render(<FileUpload accept="image/png" maxBytes={100} onFile={onFile} />);
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file('a.gif', 'image/gif')] } });
    expect(await screen.findByText(/unsupported file type/i)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [file('big.png', 'image/png', 500)] },
    });
    expect(await screen.findByText(/too large/i)).toBeInTheDocument();
    expect(onFile).not.toHaveBeenCalled();
  });
  it('exposes open()/clear() through the ref (imperative handle)', () => {
    const ref = createRef<FileUploadHandle>();
    render(<FileUpload ref={ref} accept="image/png" maxBytes={100} onFile={() => undefined} />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    act(() => ref.current!.open());
    expect(click).toHaveBeenCalled();
    expect(Object.keys(ref.current!).sort()).toEqual(['clear', 'open']); // only the intended API is exposed, not the DOM node
  });
});

describe('VirtualList (windowing)', () => {
  it('renders only the visible window of a huge list and moves the window on scroll', () => {
    const items = Array.from({ length: 5000 }, (_, i) => `Row ${i}`);
    render(
      <VirtualList
        items={items}
        rowHeight={20}
        height={100}
        getKey={(_, i) => i}
        renderRow={(r) => <span>{r}</span>}
      />,
    );
    expect(screen.getAllByRole('listitem').length).toBeLessThan(20);
    expect(screen.getByText('Row 0')).toBeInTheDocument();
    expect(screen.queryByText('Row 4000')).toBeNull();
    fireEvent.scroll(screen.getByTestId('virtual-list'), { target: { scrollTop: 4000 * 20 } });
    expect(screen.getByText('Row 4000')).toBeInTheDocument();
    expect(screen.queryByText('Row 0')).toBeNull();
  });
});

describe('Can / StatusBadge / EmployeeCard / Feedback / SearchBox', () => {
  it('Can renders by permission and falls back otherwise', () => {
    const { unmount } = renderWithProviders(
      <Can permission="employee:manage" fallback={<span>nope</span>}>
        <span>secret</span>
      </Can>,
      { role: 'EMPLOYEE' },
    );
    expect(screen.getByText('nope')).toBeInTheDocument();
    unmount();
    renderWithProviders(
      <Can permission="employee:manage" fallback={<span>nope</span>}>
        <span>secret</span>
      </Can>,
      { role: 'HR_ADMIN' },
    );
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
  it('Can supports role lists', () => {
    renderWithProviders(
      <Can roles={['MANAGER']}>
        <span>mgr</span>
      </Can>,
      { role: 'MANAGER' },
    );
    expect(screen.getByText('mgr')).toBeInTheDocument();
  });
  it('StatusBadge humanises the status', () => {
    render(<StatusBadge status="HALF_DAY" />);
    expect(screen.getByText('Half Day')).toBeInTheDocument();
  });
  it('EmployeeCard shows data and selects via a callback with its id', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<EmployeeCard employee={employee()} onSelect={onSelect} />);
    expect(screen.getByText('Alice Anders')).toBeInTheDocument();
    expect(screen.getByText(/Engineering/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(4);
  });
  it('ErrorMessage / EmptyState', async () => {
    const retry = vi.fn();
    render(
      <>
        <ErrorMessage message="bad" onRetry={retry} />
        <EmptyState title="Empty" description="try later" />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByText('try later')).toBeInTheDocument();
  });
  it('SearchBox is a controlled input with a clear button', async () => {
    const onChange = vi.fn();
    render(<SearchBox value="abc" onChange={onChange} />);
    expect(screen.getByLabelText('Search')).toHaveValue('abc');
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenCalledWith('');
    await userEvent.type(screen.getByLabelText('Search'), 'd');
    expect(onChange).toHaveBeenLastCalledWith('abcd');
  });
});

describe('utils', () => {
  it('toCsv escapes quotes/commas/newlines and neutralises spreadsheet formulas', () => {
    const csv = toCsv(
      [{ a: 'x,y', b: 'He said "hi"', c: '=SUM(A1)', d: 'line1\nline2' }],
      [
        { key: 'a', header: 'A' },
        { key: 'b', header: 'B' },
        { key: 'c', header: 'C' },
        { key: 'd', header: 'D' },
      ],
    );
    expect(csv).toBe('A,B,C,D\r\n"x,y","He said ""hi""",\'=SUM(A1),"line1\nline2"');
  });
  it('date helpers treat YYYY-MM-DD as a LOCAL calendar date (no off-by-one in any timezone)', () => {
    expect(toIsoDate(parseDate('2026-11-06'))).toBe('2026-11-06');
    expect(parseDate('2026-01-01').getDate()).toBe(1);
    expect(formatDate(null)).toBe('—');
  });
  it('parses both backend timestamp formats as UTC', () => {
    expect(parseTimestamp('2026-11-06T07:31:28Z').toISOString()).toBe('2026-11-06T07:31:28.000Z');
    expect(parseTimestamp('2026-11-06 13:01:28').toISOString()).toBe('2026-11-06T13:01:28.000Z');
  });
  it('humanize / initials', () => {
    expect(humanize('FULL_TIME')).toBe('Full Time');
    expect(initials('alice marie anders')).toBe('AM');
  });
});
