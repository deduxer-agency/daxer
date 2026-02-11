import { useState } from 'react';
import { useStore } from '../store';
import { deleteImageBlob } from '../db';
import { Lightbox } from './Lightbox';

export function GalleryPanel() {
  const { dispatch, activeProject, projectImages } = useStore();
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  if (!activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
        Select a project to view its gallery
      </div>
    );
  }

  const filtered = filter
    ? projectImages.filter((img) =>
        img.prompt.toLowerCase().includes(filter.toLowerCase())
      )
    : projectImages;

  const lightboxImg = lightboxImage
    ? projectImages.find((img) => img.id === lightboxImage)
    : null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <h2 className="text-sm font-semibold text-text">
          Gallery &middot; {filtered.length} images
        </h2>
        <div className="flex-1" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by prompt..."
          className="bg-surface-overlay border border-border rounded-lg px-3 py-1.5 text-xs text-text outline-none focus:border-border-focus w-56"
        />
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-2.5 py-1 text-xs ${
              viewMode === 'grid'
                ? 'bg-accent text-white'
                : 'bg-surface-overlay text-text-muted hover:text-text'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1 text-xs ${
              viewMode === 'list'
                ? 'bg-accent text-white'
                : 'bg-surface-overlay text-text-muted hover:text-text'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center text-text-dim text-sm py-12">
            {filter ? 'No images match your filter.' : 'No images in this project yet.'}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-4 gap-3">
            {filtered.map((img) => (
              <div
                key={img.id}
                className="group relative rounded-xl overflow-hidden border border-border hover:border-border-focus cursor-pointer transition-all"
                onClick={() => setLightboxImage(img.id)}
              >
                <div className="aspect-square">
                  <img
                    src={img.dataUrl}
                    alt={img.prompt}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Download button — always visible */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const a = document.createElement('a');
                    a.href = img.dataUrl;
                    a.download = `daxer-${img.id.slice(0, 8)}.png`;
                    a.click();
                  }}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center transition-colors"
                  title="Download image"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white/80 line-clamp-2">{img.prompt}</p>
                  <div className="text-[9px] text-white/50 mt-0.5">
                    {img.settings.aspectRatio} &middot; {img.settings.imageSize}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((img) => (
              <div
                key={img.id}
                className="flex items-center gap-3 bg-surface-raised border border-border rounded-lg p-2 hover:border-border-focus cursor-pointer transition-colors"
                onClick={() => setLightboxImage(img.id)}
              >
                <img
                  src={img.dataUrl}
                  alt={img.prompt}
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate">{img.prompt}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {img.settings.aspectRatio} &middot; {img.settings.imageSize} &middot;{' '}
                    {new Date(img.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'SET_SELECTED_IMAGE', payload: img.id });
                      dispatch({ type: 'SET_VIEW', payload: 'edit' });
                    }}
                    className="text-xs text-accent hover:text-accent-hover px-2 py-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const a = document.createElement('a');
                      a.href = img.dataUrl;
                      a.download = `daxer-${img.id.slice(0, 8)}.png`;
                      a.click();
                    }}
                    className="text-xs text-text-muted hover:text-text px-2 py-1"
                  >
                    Save
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'DELETE_GENERATED_IMAGE', payload: img.id });
                      deleteImageBlob(img.id).catch(() => {});
                    }}
                    className="text-xs text-text-dim hover:text-danger px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <Lightbox
          imageUrl={lightboxImg.dataUrl}
          alt={lightboxImg.prompt}
          onClose={() => setLightboxImage(null)}
          details={{
            title: lightboxImg.prompt,
            subtitle: `${lightboxImg.settings.aspectRatio} · ${lightboxImg.settings.imageSize} · ${new Date(lightboxImg.createdAt).toLocaleString()}`,
          }}
          actions={
            <>
              <button
                onClick={() => {
                  dispatch({ type: 'SET_SELECTED_IMAGE', payload: lightboxImg.id });
                  dispatch({ type: 'SET_VIEW', payload: 'edit' });
                  setLightboxImage(null);
                }}
                className="bg-accent hover:bg-accent-hover text-white text-xs px-3 py-1.5 rounded-lg"
              >
                Edit / Variations
              </button>
              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = lightboxImg.dataUrl;
                  a.download = `daxer-${lightboxImg.id.slice(0, 8)}.png`;
                  a.click();
                }}
                className="bg-surface-overlay hover:bg-surface-raised text-white text-xs px-3 py-1.5 rounded-lg border border-border"
              >
                Download
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
