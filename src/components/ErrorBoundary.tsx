import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[Daxer] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-surface p-8">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold text-text mb-2">Something went wrong</h2>
            <p className="text-sm text-text-muted mb-4">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="bg-accent hover:bg-accent-hover text-white text-sm px-4 py-2 rounded-lg"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('daxer-studio-state');
                  window.location.reload();
                }}
                className="bg-surface-overlay hover:bg-surface-raised text-text text-sm px-4 py-2 rounded-lg border border-border"
              >
                Reset App
              </button>
            </div>
            <p className="text-xs text-text-dim mt-4">
              If the issue persists, click "Reset App" to clear all data and start fresh.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
