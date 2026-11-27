import { useEffect, useMemo } from 'react';
import type { FieldValues, Path } from 'react-hook-form';
import { FormSelect } from './fields';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { fetchEmployeeDirectory } from '@/store/slices/employeeSlice';
import { directorySelectors } from '@/store/selectors/employeeSelectors';

/**
 * Manager picker fed by the normalised Redux employee directory (`createEntityAdapter`): loaded once, shared by every form,
 * and de-duplicated by the thunk's `condition`. An employee cannot be their own manager, hence `excludeId`.
 */
export function ManagerSelect<T extends FieldValues>({
  name,
  excludeId,
  label = 'Manager',
}: {
  name: Path<T>;
  excludeId?: number;
  label?: string;
}) {
  const dispatch = useAppDispatch();
  const all = useAppSelector(directorySelectors.selectAll);
  useEffect(() => {
    void dispatch(fetchEmployeeDirectory());
  }, [dispatch]);
  const options = useMemo(
    () =>
      all
        .filter((e) => e.id !== excludeId)
        .map((e) => ({ value: String(e.id), label: `${e.name} (${e.code})` })),
    [all, excludeId],
  );
  return <FormSelect<T> name={name} label={label} options={options} emptyLabel="No manager" />;
}
