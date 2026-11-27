// @vitest-environment jsdom
import './setup-dom';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOrganization } from '@/hooks/useOrganization';
import type { OrgNode } from '@/schemas/api';

const node = (id: number, name: string, subordinates: OrgNode[] = []): OrgNode => ({ id, employeeCode: `E${id}`, name, workEmail: `${name}@x.io`, designation: null, jobTitle: null, department: null, managerId: null, profilePictureUrl: null, directReportCount: subordinates.length, subordinates });
const tree = [node(1, 'Boss', [node(2, 'Mid', [node(3, 'Ella Leaf')]), node(4, 'Other')])];

describe('useOrganization', () => {
  it('starts with the roots expanded and toggles branches', () => {
    const { result } = renderHook(() => useOrganization(tree));
    expect([...result.current.expanded]).toEqual([1]);
    act(() => result.current.toggle(2)); expect(result.current.expanded.has(2)).toBe(true);
    act(() => result.current.toggle(2)); expect(result.current.expanded.has(2)).toBe(false);
  });
  it('search is case-insensitive, highlights matches, reveals their ancestors and settles (searching → false)', async () => {
    const { result } = renderHook(() => useOrganization(tree));
    act(() => result.current.setTerm('ELLA'));
    expect([...result.current.matches]).toEqual([3]);
    expect([...result.current.ancestors].sort()).toEqual([1, 2]);
    expect(result.current.searching).toBe(false); // regression: raw vs lower-cased comparison used to keep this true forever
  });
  it('expandAll / collapseAll', () => {
    const { result } = renderHook(() => useOrganization(tree));
    act(() => result.current.expandAll()); expect([...result.current.expanded].sort()).toEqual([1, 2]);
    act(() => result.current.collapseAll()); expect(result.current.expanded.size).toBe(0);
  });
});
