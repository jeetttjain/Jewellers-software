import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI component tree:', error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full surface-card p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900">Application Error</h2>
              <p className="text-sm text-surface-700 mt-1">
                A client-side error occurred. The terminal state has been safely isolated.
              </p>
              {this.state.error && (
                <pre className="mt-3 p-3 bg-surface-100 rounded text-left text-xs font-mono text-red-700 overflow-x-auto">
                  {this.state.error.message}
                </pre>
              )}
            </div>
            <button
              onClick={this.handleReload}
              className="btn-primary w-full gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Terminal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
