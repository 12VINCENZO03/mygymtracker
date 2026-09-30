import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 🔴 NUOVO: Scudo di protezione (ErrorBoundary) contro i crash fatali
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <i className="fa-solid fa-triangle-exclamation text-rose-500 text-6xl mb-5 animate-bounce"></i>
          <h1 className="text-2xl font-black mb-2 text-rose-400">Ops! Errore critico.</h1>
          <p className="text-zinc-400 mb-8 text-sm max-w-sm">
            L'applicazione ha riscontrato dati corrotti o un errore imprevisto. 
            Ricarica la pagina per tentare il ripristino.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-emerald-500 text-zinc-950 px-8 py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-transform"
          >
            Ricarica Applicazione
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
