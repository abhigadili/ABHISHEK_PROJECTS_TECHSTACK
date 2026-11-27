import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
/** Catches render errors so one broken widget never blanks the whole portal. */
export class ErrorBoundary extends Component<{ children: ReactNode; fallbackTitle?: string; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('UI error', e, i.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="hr-card m-4 p-6 text-center">
        <h3 className="mb-1">{this.props.fallbackTitle ?? 'This section failed to load'}</h3>
        <p className="mb-3 text-xs text-muted">{this.state.error.message}</p>
        <Button onClick={() => this.setState({ error: null })}>Try again</Button>
      </div>
    );
  }
}
