interface DragDropOverlayProps {
  isVisible: boolean;
}

export function DragDropOverlay({ isVisible }: DragDropOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-accent/20 backdrop-blur-sm border-4 border-dashed border-accent animate-pulse">
        <div className="flex items-center justify-center h-full">
          <div className="bg-surface-overlay/95 backdrop-blur-md border-2 border-accent rounded-2xl p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              <svg
                className="w-16 h-16 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <div className="text-center">
                <p className="text-xl font-semibold text-text mb-1">
                  Drop image here
                </p>
                <p className="text-sm text-text-muted">
                  Add to reference images
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
