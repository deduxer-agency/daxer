import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import Konva from 'konva';

interface ImageEditorProps {
  imageUrl: string;
  onMaskChange: (maskDataUrl: string | null) => void;
  disabled?: boolean;
}

interface Stroke {
  points: number[];
  brushSize: number;
}

export function ImageEditor({ imageUrl, onMaskChange, disabled }: ImageEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [currentStroke, setCurrentStroke] = useState<number[]>([]);

  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Load image
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      setImage(img);
      // Calculate dimensions to fit container (max 800x600, maintain aspect ratio)
      const maxWidth = 800;
      const maxHeight = 600;
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
      setDimensions({
        width: Math.floor(img.width * ratio),
        height: Math.floor(img.height * ratio)
      });
    };
  }, [imageUrl]);

  // Export mask when strokes change
  useEffect(() => {
    if (strokes.length === 0) {
      onMaskChange(null);
      return;
    }

    // Export mask as dataURL using offscreen canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = dimensions.width;
    maskCanvas.height = dimensions.height;
    const ctx = maskCanvas.getContext('2d');

    if (!ctx) {
      onMaskChange(null);
      return;
    }

    // Draw white strokes on transparent background
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    ctx.strokeStyle = 'white';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach(stroke => {
      ctx.lineWidth = stroke.brushSize;
      ctx.beginPath();
      for (let i = 0; i < stroke.points.length; i += 2) {
        const x = stroke.points[i];
        const y = stroke.points[i + 1];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    const maskDataUrl = maskCanvas.toDataURL('image/png');
    onMaskChange(maskDataUrl);
  }, [strokes, dimensions, onMaskChange]);

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (disabled) return;
    setIsDrawing(true);
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) setCurrentStroke([pos.x, pos.y]);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || disabled) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) setCurrentStroke([...currentStroke, pos.x, pos.y]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes([...strokes, { points: currentStroke, brushSize }]);
      setCurrentStroke([]);
    }
  };

  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke([]);
  }, []);

  const handleUndo = useCallback(() => {
    setStrokes(strokes.slice(0, -1));
  }, [strokes]);

  if (!image) {
    return (
      <div className="flex items-center justify-center h-96 bg-surface-overlay rounded-xl border border-border">
        <p className="text-text-muted">Loading image...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center gap-4 p-3 bg-surface-overlay rounded-lg border border-border">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs text-text-muted whitespace-nowrap">Brush Size:</label>
          <input
            type="range"
            min="10"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            disabled={disabled}
            className="flex-1 accent-accent"
          />
          <span className="text-xs text-text-muted w-12 text-right">{brushSize}px</span>
        </div>
        <button
          onClick={handleUndo}
          disabled={disabled || strokes.length === 0}
          className="text-xs px-3 py-1.5 bg-surface-raised hover:bg-surface border border-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Undo
        </button>
        <button
          onClick={handleClear}
          disabled={disabled || strokes.length === 0}
          className="text-xs px-3 py-1.5 bg-surface-raised hover:bg-surface border border-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Canvas */}
      <div className="relative border border-border rounded-xl overflow-hidden bg-surface-overlay flex items-center justify-center">
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: disabled ? 'not-allowed' : 'crosshair' }}
        >
          {/* Background: Original Image */}
          <Layer>
            <KonvaImage
              image={image}
              width={dimensions.width}
              height={dimensions.height}
            />
          </Layer>

          {/* Foreground: Selection Overlay */}
          <Layer>
            {/* Completed strokes */}
            {strokes.map((stroke, i) => (
              <Line
                key={i}
                points={stroke.points}
                stroke="rgba(59, 130, 246, 0.5)"
                strokeWidth={stroke.brushSize}
                lineCap="round"
                lineJoin="round"
              />
            ))}

            {/* Current stroke being drawn */}
            {isDrawing && currentStroke.length > 0 && (
              <Line
                points={currentStroke}
                stroke="rgba(59, 130, 246, 0.5)"
                strokeWidth={brushSize}
                lineCap="round"
                lineJoin="round"
              />
            )}
          </Layer>
        </Stage>
      </div>

      <p className="text-xs text-text-dim text-center">
        Draw on the image to select areas for editing. Selected regions will be highlighted in blue.
      </p>
    </div>
  );
}
