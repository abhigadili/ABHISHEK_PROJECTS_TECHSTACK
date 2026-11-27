import { Component } from 'react';

/**
 * LEGACY EXAMPLE (class component) — shown only so you can read old React code. Do not write new components like this.
 * Lifecycle mapping: constructor/state → useState · componentDidMount → useEffect(…, []) · componentDidUpdate → useEffect(…, [dep])
 * · componentWillUnmount → the cleanup function returned from useEffect.
 */
export class LegacyCounter extends Component<{ onLog: (m: string) => void }, { count: number }> {
  state = { count: 0 };
  componentDidMount() {
    this.props.onLog('class: componentDidMount');
  }
  componentDidUpdate(_p: unknown, prev: { count: number }) {
    if (prev.count !== this.state.count)
      this.props.onLog(`class: componentDidUpdate (count ${prev.count} → ${this.state.count})`);
  }
  componentWillUnmount() {
    this.props.onLog('class: componentWillUnmount');
  }
  render() {
    return (
      <button onClick={() => this.setState((s) => ({ count: s.count + 1 }))}>
        Class counter: {this.state.count}
      </button>
    );
  }
}
