"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  doc?: { title: string };
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: { componentStack: string };
}

export class MatchDocumentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    this.setState({ errorInfo });
    console.error(
      "[MatchDocumentErrorBoundary] Caught error:",
      error,
      "\nComponent stack:",
      errorInfo.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      const errorText = `${this.state.error?.name || "Error"}: ${this.state.error?.message || "Unknown error"}`;
      const details = {
        document: this.props.doc?.title,
        error: errorText,
        stack: this.state.error?.stack,
      };

      return (
        <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
              Error matching document
            </h2>
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded p-4 mb-4">
              <p className="text-sm text-red-700 dark:text-red-400 font-mono break-all">
                {errorText}
              </p>
            </div>

            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                Debug Information:
              </p>
              <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-auto max-h-40 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                {JSON.stringify(details, null, 2)}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(details, null, 2));
                  alert("Debug info copied to clipboard");
                }}
                className="mt-2 text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Copy to clipboard
              </button>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
