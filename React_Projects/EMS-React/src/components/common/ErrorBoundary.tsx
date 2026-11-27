import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, AlertTitle, Button, Stack } from '@mui/material';

interface Props {
  children: ReactNode;
  /** Custom fallback UI; receives the error and a `reset` that re-renders the children. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Reset automatically when any of these values change (e.g. the route path). */
  resetKeys?: unknown[];
  onError?: (error: Error, info: ErrorInfo) => void;
}
interface State {
  error: Error | null;
}

/**
 * The ONE legitimate class component in the app: React has no Hook for error boundaries (`getDerivedStateFromError` /
 * `componentDidCatch` exist only on classes). It catches errors thrown while RENDERING its subtree (and in lifecycle methods).
 * It does NOT catch event-handler errors, async/Promise rejections or API failures — those are handled with try/catch,
 * RTK Query `isError` and the Axios interceptor (see docs/react-concepts/24-error-boundaries.md).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack); // logging hook: send to Sentry/Datadog here in production
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prev: Props) {
    if (
      this.state.error &&
      prev.resetKeys &&
      this.props.resetKeys &&
      prev.resetKeys.some((k, i) => !Object.is(k, this.props.resetKeys![i]))
    ) {
      this.reset();
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <Alert severity="error" role="alert" sx={{ m: 2 }}>
        <AlertTitle>This part of the page crashed</AlertTitle>
        <Stack spacing={1} alignItems="flex-start">
          <span>{error.message}</span>
          <Button size="small" variant="outlined" color="inherit" onClick={this.reset}>
            Try again
          </Button>
        </Stack>
      </Alert>
    );
  }
}
