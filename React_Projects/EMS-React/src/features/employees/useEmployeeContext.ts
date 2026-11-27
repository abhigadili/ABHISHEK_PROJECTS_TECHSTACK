import { useOutletContext } from 'react-router-dom';
import type { EmployeeOutletContext } from './EmployeeLayout';

/** Typed access to the employee loaded by the parent layout route. */
export const useEmployeeContext = () => useOutletContext<EmployeeOutletContext>();
