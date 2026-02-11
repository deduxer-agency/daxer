import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface LightboxProps {
  imageUrl: string;
  alt: string;
  onClose: () => void;
  details?: {
    title?: string;
    subtitle?: string;
  };
  actions?: React.ReactNode;
  onEdit?: () => void;
}

export function Lightbox({ imageUrl, alt, onClose, details, actions, onEdit }: LightboxProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Zoom Controls - Top Right */}
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={5}
          wheel={{ step: 0.1 }}
          doubleClick={{ mode: 'zoomIn' }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 bg-black/60 backdrop-blur-sm rounded-lg p-1">
                <button
                  onClick={() => zoomIn()}
                  className="p-2 text-white hover:bg-white/10 rounded transition-colors"
                  title="Zoom In"
                  aria-label="Zoom in"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                </button>
                <button
                  onClick={() => zoomOut()}
                  className="p-2 text-white hover:bg-white/10 rounded transition-colors"
                  title="Zoom Out"
                  aria-label="Zoom out"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <button
                  onClick={() => resetTransform()}
                  className="p-2 text-white hover:bg-white/10 rounded transition-colors"
                  title="Reset Zoom"
                  aria-label="Reset zoom"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              <TransformComponent>
                <img
                  src={imageUrl}
                  alt={alt}
                  className="max-w-[85vw] max-h-[80vh] rounded-xl object-contain"
                />
              </TransformComponent>
            </>
          )}
        </TransformWrapper>

        {/* Details and Actions */}
        {(details || actions || onEdit) && (
          <div className="mt-3 flex items-start justify-between gap-4">
            {details && (
              <div className="flex-1">
                {details.title && <p className="text-sm text-white">{details.title}</p>}
                {details.subtitle && (
                  <p className="text-xs text-white/50 mt-1">{details.subtitle}</p>
                )}
              </div>
            )}
            <div className="flex gap-2 shrink-0">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="bg-accent hover:bg-accent-hover text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                >
                  Edit
                </button>
              )}
              {actions}
              <button
                onClick={onClose}
                className="text-white/50 hover:text-white text-sm px-2 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Helper Text */}
        <p className="mt-2 text-xs text-white/40 text-center">
          Double-click to zoom • Scroll to zoom • Drag to pan
        </p>
      </div>
    </div>
  );
}
