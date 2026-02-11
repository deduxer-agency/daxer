interface LightboxProps {
  imageUrl: string;
  alt: string;
  onClose: () => void;
  details?: {
    title?: string;
    subtitle?: string;
  };
  actions?: React.ReactNode;
}

export function Lightbox({ imageUrl, alt, onClose, details, actions }: LightboxProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="relative max-w-[85vw] max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="max-w-full max-h-[80vh] rounded-xl object-contain"
        />
        {(details || actions) && (
          <div className="mt-3 flex items-start justify-between gap-4">
            {details && (
              <div>
                {details.title && <p className="text-sm text-white">{details.title}</p>}
                {details.subtitle && (
                  <p className="text-xs text-white/50 mt-1">{details.subtitle}</p>
                )}
              </div>
            )}
            <div className="flex gap-2 shrink-0">
              {actions}
              <button
                onClick={onClose}
                className="text-white/50 hover:text-white text-sm px-2"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
