import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Changing this value resets the boundary (e.g. the current route path). */
  resetKey?: unknown;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  label?: string;
}
interface State {
  error: Error | null;
}

/**
 * Error boundary (React still requires a class component for componentDidCatch / getDerivedStateFromError).
 * It wraps the routed content in the app layout so one crashing page never blanks the sidebar/header, and it resets
 * itself when the route changes.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div role="alert" className="mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <AlertOctagon className="h-10 w-10" />
        <h2 className="text-lg font-semibold">This section crashed</h2>
        <p className="text-sm opacity-80">{error.message}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={this.reset}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.assign('/dashboard')}>Go to dashboard</Button>
        </div>
      </div>
    );
  }
}
