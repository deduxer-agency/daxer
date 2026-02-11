import { StoreProvider, useStore } from './store';
import { Sidebar } from './components/Sidebar';
import { GenerationPanel } from './components/GenerationPanel';
import { GalleryPanel } from './components/GalleryPanel';
import { EditPanel } from './components/EditPanel';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const { state } = useStore();

  if (!state.hydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-muted">Loading Daxer Studio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {state.view === 'generate' && <GenerationPanel />}
        {state.view === 'gallery' && <GalleryPanel />}
        {state.view === 'edit' && <EditPanel />}
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </ErrorBoundary>
  );
}

export default App;
