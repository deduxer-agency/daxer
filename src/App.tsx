import { useState, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { StoreProvider, useStore } from './store';
import { Sidebar } from './components/Sidebar';
import { GenerationPanel } from './components/GenerationPanel';
import { GalleryPanel } from './components/GalleryPanel';
import { EditPanel } from './components/EditPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DragDropOverlay } from './components/DragDropOverlay';
import { compressImages } from './imageUtils';
import { saveImageBlob } from './db';

function AppContent() {
  const { state, dispatch, activeProject } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.current += 1;

    // Check if dragging files
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const hasImages = Array.from(e.dataTransfer.items).some(
        (item) => item.kind === 'file' && item.type.startsWith('image/')
      );
      if (hasImages) {
        setIsDragging(true);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(false);
    dragCounter.current = 0;

    // Only process if we have an active project
    if (!activeProject) {
      alert('Please select or create a project first');
      return;
    }

    // Get image files
    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );

    if (files.length === 0) {
      return;
    }

    try {
      // Compress images
      const compressed = await compressImages(files);

      // Create reference images with IDs
      const referenceImages = compressed.map((img) => ({
        id: uuid(),
        name: img.name,
        dataUrl: img.dataUrl,
        mimeType: img.mimeType,
      }));

      // Save to IndexedDB
      for (const img of referenceImages) {
        await saveImageBlob(img.id, img.dataUrl);
      }

      // Add to project
      dispatch({
        type: 'ADD_REFERENCE_IMAGES_BATCH',
        payload: {
          projectId: activeProject.id,
          images: referenceImages,
        },
      });
    } catch (error) {
      console.error('Failed to process dropped images:', error);
      alert('Failed to process dropped images. Please try again.');
    }
  };

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
    <div
      className="flex h-screen overflow-hidden bg-surface"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {state.view === 'generate' && <GenerationPanel />}
        {state.view === 'gallery' && <GalleryPanel />}
        {state.view === 'edit' && <EditPanel />}
      </main>
      <DragDropOverlay isVisible={isDragging} />
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
