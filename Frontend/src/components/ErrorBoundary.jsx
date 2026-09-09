import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI error caught by ErrorBoundary:', error, errorInfo);

    // Auto-reload once if dynamic import / chunk failed
    const isChunkError = 
      error?.message?.includes('dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.name === 'ChunkLoadError';

    if (isChunkError) {
      const hasReloaded = sessionStorage.getItem('chunk_reload_attempted');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload_attempted', 'true');
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    sessionStorage.removeItem('chunk_reload_attempted');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 text-2xl font-bold">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-500 max-w-sm mb-6">
            A new version of the app might be available or your connection was interrupted.
          </p>
          <button
            onClick={this.handleReload}
            className="px-6 py-2.5 bg-[#0B132B] text-white font-bold rounded-xl text-sm shadow-md hover:bg-slate-800 transition active:scale-95"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
