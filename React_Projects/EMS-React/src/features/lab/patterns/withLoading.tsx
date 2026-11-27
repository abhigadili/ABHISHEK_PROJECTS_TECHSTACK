import type { ComponentType } from 'react';
import { Loading } from '@/components/common/Feedback';

/**
 * Higher-Order Component: a FUNCTION that takes a component and returns a new one with extra behaviour.
 * `withLoading(EmployeeTable)` renders a spinner while `loading` is true, otherwise the wrapped component with its original props.
 * (Today a custom Hook or composition is usually preferred; HOCs remain common in older code, and in libraries such as react-redux's connect.)
 */
export function withLoading<P extends object>(Wrapped: ComponentType<P>) {
  function WithLoading({ loading, ...props }: P & { loading: boolean }) {
    return loading ? <Loading /> : <Wrapped {...(props as unknown as P)} />;
  }
  WithLoading.displayName = `withLoading(${Wrapped.displayName ?? Wrapped.name ?? 'Component'})`; // readable name in DevTools
  return WithLoading;
}
