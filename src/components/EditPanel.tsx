import { useState, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { generateImage } from '../gemini';
import { saveImageBlob } from '../db';
import { SettingsBar } from './SettingsBar';
import type { GenerationSettings, GeneratedImage } from '../types';

export function EditPanel() {
  const { state, dispatch, activeProject, projectImages } = useStore();
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [variationResults, setVariationResults] = useState<GeneratedImage[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const abortControllers = useRef<AbortController[]>([]);

  const selectedImage = state.selectedImageId
    ? projectImages.find((img) => img.id === state.selectedImageId) || null
    : null;

  const handleEdit = useCallback(async () => {
    if (!editPrompt.trim() || !selectedImage || !activeProject || !state.apiKey) return;

    const settings: GenerationSettings = { ...state.defaultSettings };
    const count = settings.numberOfVariations;
    setIsEditing(true);
    setVariationResults([]);
    setErrors([]);

    const controllers: AbortController[] = [];

    const promises = Array.from({ length: count }, async (_, i) => {
      const controller = new AbortController();
      controllers.push(controller);
      abortControllers.current = controllers;

      try {
        const result = await generateImage(
          state.apiKey,
          editPrompt.trim(),
          activeProject,
          settings,
          state.modelId,
          selectedImage,
          controller.signal
        );

        await saveImageBlob(result.id, result.dataUrl);
        dispatch({ type: 'ADD_GENERATED_IMAGE', payload: result });
        setVariationResults((prev) => [...prev, result]);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setErrors((prev) => [
          ...prev,
          `Variation ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        ]);
      }
    });

    await Promise.allSettled(promises);
    setIsEditing(false);
    abortControllers.current = [];
  }, [editPrompt, selectedImage, activeProject, state.apiKey, state.modelId, state.defaultSettings, dispatch]);

  const cancelEdit = () => {
    abortControllers.current.forEach((c) => c.abort());
    abortControllers.current = [];
    setIsEditing(false);
  };

  const generateVariationsOnly = useCallback(async () => {
    if (!selectedImage || !activeProject || !state.apiKey) return;

    const settings: GenerationSettings = { ...state.defaultSettings };
    const count = settings.numberOfVariations;
    setIsEditing(true);
    setVariationResults([]);
    setErrors([]);

    const variationPrompt = `Create a variation of this image. Keep the same overall composition and style but make subtle creative differences. ${activeProject.stylePrompt ? `Maintain the style: ${activeProject.stylePrompt}` : ''}`;

    const controllers: AbortController[] = [];

    const promises = Array.from({ length: count }, async (_, i) => {
      const controller = new AbortController();
      controllers.push(controller);
      abortControllers.current = controllers;

      try {
        const result = await generateImage(
          state.apiKey,
          variationPrompt,
          activeProject,
          settings,
          state.modelId,
          selectedImage,
          controller.signal
        );

        await saveImageBlob(result.id, result.dataUrl);
        dispatch({ type: 'ADD_GENERATED_IMAGE', payload: result });
        setVariationResults((prev) => [...prev, result]);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setErrors((prev) => [
          ...prev,
          `Variation ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        ]);
      }
    });

    await Promise.allSettled(promises);
    setIsEditing(false);
    abortControllers.current = [];
  }, [selectedImage, activeProject, state.apiKey, state.modelId, state.defaultSettings, dispatch]);

  if (!activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
        Select a project first
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left: Source Image Selection */}
      <div className="w-72 border-r border-border flex flex-col overflow-hidden shrink-0">
        <div className="p-3 border-b border-border">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Select Source Image
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {projectImages.length === 0 ? (
            <p className="text-xs text-text-dim text-center py-8">
              Generate some images first,
              <br />
              then come back to edit them.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {projectImages.map((img) => (
                <div
                  key={img.id}
                  onClick={() => dispatch({ type: 'SET_SELECTED_IMAGE', payload: img.id })}
                  className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                    state.selectedImageId === img.id
                      ? 'border-accent shadow-lg shadow-accent/20'
                      : 'border-transparent hover:border-border-focus'
                  }`}
                >
                  <img
                    src={img.dataUrl}
                    alt={img.prompt}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Edit Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedImage ? (
          <>
            {/* Preview */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden bg-surface">
              <div className="relative max-w-full max-h-full">
                <img
                  src={selectedImage.dataUrl}
                  alt={selectedImage.prompt}
                  className="max-w-full max-h-[50vh] rounded-xl object-contain border border-border"
                />
                <div className="mt-2">
                  <p className="text-xs text-text-muted truncate">{selectedImage.prompt}</p>
                  <p className="text-[10px] text-text-dim">
                    {selectedImage.settings.aspectRatio} &middot; {selectedImage.settings.imageSize}
                    {selectedImage.parentImageId && ' &middot; Edited'}
                  </p>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="px-4 py-2 border-t border-border">
              <SettingsBar />
            </div>

            {/* Edit Controls */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2 mb-3">
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleEdit();
                    }
                  }}
                  placeholder="Describe how to edit this image... e.g., 'change the background to a sunset', 'make it more vibrant', 'add a hat'"
                  className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-border-focus resize-none h-14"
                  disabled={isEditing}
                />
                <div className="flex flex-col gap-1">
                  <button
                    onClick={handleEdit}
                    disabled={!editPrompt.trim() || isEditing || !state.apiKey}
                    className="bg-accent hover:bg-accent-hover disabled:bg-surface-overlay disabled:text-text-dim text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                  >
                    {isEditing ? 'Editing...' : 'Edit Image'}
                  </button>
                  <button
                    onClick={generateVariationsOnly}
                    disabled={isEditing || !state.apiKey}
                    className="bg-surface-overlay hover:bg-surface-raised disabled:text-text-dim border border-border text-text text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Variations
                  </button>
                  {isEditing && (
                    <button onClick={cancelEdit} className="text-[10px] text-danger hover:text-red-400">
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Quick edit presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Make it more vibrant',
                  'Change to dark mood',
                  'Add warm lighting',
                  'Make background blurry',
                  'Convert to illustration style',
                  'Remove background',
                  'Make it more detailed',
                  'Simplify the composition',
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setEditPrompt(preset)}
                    className="text-[10px] text-text-muted hover:text-text bg-surface-overlay hover:bg-surface-raised border border-border rounded-full px-2.5 py-0.5 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Variation Results */}
            {(variationResults.length > 0 || errors.length > 0 || isEditing) && (
              <div className="border-t border-border p-4 max-h-52 overflow-y-auto">
                <div className="text-xs text-text-muted mb-2">
                  {isEditing
                    ? 'Generating variations...'
                    : `${variationResults.length} variation${variationResults.length !== 1 ? 's' : ''} created`}
                </div>

                {errors.map((err, i) => (
                  <div key={i} className="text-xs text-danger mb-1">
                    {err}
                  </div>
                ))}

                <div className="flex gap-2 overflow-x-auto pb-2">
                  {isEditing &&
                    variationResults.length < state.defaultSettings.numberOfVariations &&
                    Array.from({
                      length: state.defaultSettings.numberOfVariations - variationResults.length,
                    }).map((_, i) => (
                      <div
                        key={`loading-${i}`}
                        className="w-24 h-24 shrink-0 bg-surface-overlay border border-border rounded-lg flex items-center justify-center"
                      >
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      </div>
                    ))}

                  {variationResults.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => dispatch({ type: 'SET_SELECTED_IMAGE', payload: img.id })}
                      className={`w-24 h-24 shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                        state.selectedImageId === img.id
                          ? 'border-accent'
                          : 'border-border hover:border-border-focus'
                      }`}
                    >
                      <img
                        src={img.dataUrl}
                        alt={img.prompt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
            Select an image from the left panel to edit it
          </div>
        )}
      </div>
    </div>
  );
}
