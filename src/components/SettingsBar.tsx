import { useStore } from '../store';
import { getAvailableModels, type ModelId } from '../gemini';
import type { AspectRatio, ImageSize } from '../types';

const ASPECT_RATIOS: AspectRatio[] = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
];

const IMAGE_SIZES: { value: ImageSize; label: string }[] = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

export function SettingsBar() {
  const { state, dispatch } = useStore();
  const settings = state.defaultSettings;

  const MODEL_LABELS: Record<string, string> = {
    'gemini-2.5-flash-image': 'Nano Banana (Flash)',
    'gemini-3-pro-image-preview': 'Nano Banana Pro',
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Model */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-text-muted whitespace-nowrap">Model</label>
        <select
          value={state.modelId}
          onChange={(e) =>
            dispatch({ type: 'SET_MODEL_ID', payload: e.target.value as ModelId })
          }
          className="bg-surface-overlay border border-border rounded px-2 py-1 text-xs text-text outline-none focus:border-border-focus cursor-pointer"
        >
          {getAvailableModels().map((m) => (
            <option key={m} value={m}>
              {MODEL_LABELS[m] || m}
            </option>
          ))}
        </select>
      </div>

      {/* Aspect Ratio */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-text-muted whitespace-nowrap">Ratio</label>
        <select
          value={settings.aspectRatio}
          onChange={(e) =>
            dispatch({
              type: 'SET_DEFAULT_SETTINGS',
              payload: { aspectRatio: e.target.value as AspectRatio },
            })
          }
          className="bg-surface-overlay border border-border rounded px-2 py-1 text-xs text-text outline-none focus:border-border-focus cursor-pointer"
        >
          {ASPECT_RATIOS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Image Size */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-text-muted whitespace-nowrap">Size</label>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {IMAGE_SIZES.map((size) => (
            <button
              key={size.value}
              onClick={() =>
                dispatch({
                  type: 'SET_DEFAULT_SETTINGS',
                  payload: { imageSize: size.value },
                })
              }
              className={`px-2.5 py-1 text-xs transition-colors ${
                settings.imageSize === size.value
                  ? 'bg-accent text-white'
                  : 'bg-surface-overlay text-text-muted hover:text-text'
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>
      </div>

      {/* Temperature */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-text-muted whitespace-nowrap">Creativity</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={settings.temperature}
          onChange={(e) =>
            dispatch({
              type: 'SET_DEFAULT_SETTINGS',
              payload: { temperature: parseFloat(e.target.value) },
            })
          }
          className="w-20"
        />
        <span className="text-xs text-text-dim w-6 text-right">{settings.temperature}</span>
      </div>

      {/* Number of Variations */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-text-muted whitespace-nowrap">Variations</label>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {[1, 2, 3, 4, 6].map((n) => (
            <button
              key={n}
              onClick={() =>
                dispatch({
                  type: 'SET_DEFAULT_SETTINGS',
                  payload: { numberOfVariations: n },
                })
              }
              className={`px-2 py-1 text-xs transition-colors ${
                settings.numberOfVariations === n
                  ? 'bg-accent text-white'
                  : 'bg-surface-overlay text-text-muted hover:text-text'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
