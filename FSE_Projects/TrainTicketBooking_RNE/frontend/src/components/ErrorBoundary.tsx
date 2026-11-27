import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

/** Class-based error boundary: catches render errors in a subtree and offers a retry instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode; fallbackTitle?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[ErrorBoundary]', error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto my-16 max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-red-800">{this.props.fallbackTitle ?? 'Something went wrong'}</h2>
        <p className="mt-2 text-sm text-red-700">{this.state.error.message}</p>
        <Button className="mt-4" onClick={() => this.setState({ error: null })}>Try again</Button>
      </div>
    );
  }
}
