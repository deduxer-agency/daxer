import { useState, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useStore } from '../store';
import { generateImage, enhancePrompt } from '../gemini';
import { saveImageBlob, deleteImageBlob } from '../db';
import { SettingsBar } from './SettingsBar';
import { ProjectSettings } from './ProjectSettings';
import type { GenerationSettings } from '../types';

export function GenerationPanel() {
  const { state, dispatch, activeProject, projectImages } = useStore();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [useAiEnhancement, setUseAiEnhancement] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const activeRequests = state.generationQueue.filter(
    (r) => r.status === 'pending' || r.status === 'generating'
  );

  const startGeneration = useCallback(async () => {
    if (!prompt.trim() || !activeProject || !state.apiKey) return;

    const settings: GenerationSettings = { ...state.defaultSettings };
    const count = settings.numberOfVariations;
    let currentPrompt = prompt.trim();
    const batchId = uuid(); // Generate batchId for this generation session

    // Enhance prompt if AI enhancement is enabled
    if (useAiEnhancement) {
      try {
        setIsEnhancing(true);
        const enhanced = await enhancePrompt(state.apiKey, currentPrompt);
        currentPrompt = enhanced;
        setEnhancedPrompt(enhanced);
      } catch (error) {
        console.error('Prompt enhancement failed:', error);
        // Continue with original prompt if enhancement fails
        alert(`Prompt enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}. Using original prompt.`);
      } finally {
        setIsEnhancing(false);
      }
    } else {
      setEnhancedPrompt(null);
    }

    setPrompt('');
    setIsGenerating(true);

    const requestIds: string[] = [];

    // Create all request entries
    for (let i = 0; i < count; i++) {
      const id = uuid();
      requestIds.push(id);
      dispatch({
        type: 'ADD_GENERATION_REQUEST',
        payload: {
          id,
          projectId: activeProject.id,
          prompt: currentPrompt,
          status: 'pending',
          settings,
          startedAt: Date.now(),
        },
      });
    }

    // Fire all requests concurrently
    const promises = requestIds.map(async (reqId) => {
      const controller = new AbortController();
      abortControllers.current.set(reqId, controller);

      dispatch({
        type: 'UPDATE_GENERATION_REQUEST',
        payload: { id: reqId, status: 'generating' },
      });

      try {
        const result = await generateImage(
          state.apiKey,
          currentPrompt,
          activeProject,
          settings,
          state.modelId,
          undefined,
          undefined,
          controller.signal
        );

        // Add batchId to the result
        const resultWithBatch = { ...result, batchId };

        // Persist to IndexedDB, then add to state
        await saveImageBlob(resultWithBatch.id, resultWithBatch.dataUrl);
        dispatch({ type: 'ADD_GENERATED_IMAGE', payload: resultWithBatch });
        dispatch({
          type: 'UPDATE_GENERATION_REQUEST',
          payload: { id: reqId, status: 'completed', result: resultWithBatch },
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        dispatch({
          type: 'UPDATE_GENERATION_REQUEST',
          payload: {
            id: reqId,
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
          },
        });
      } finally {
        abortControllers.current.delete(reqId);
      }
    });

    await Promise.allSettled(promises);
    setIsGenerating(false);
  }, [prompt, activeProject, state.apiKey, state.modelId, state.defaultSettings, dispatch, useAiEnhancement]);

  const cancelAll = () => {
    abortControllers.current.forEach((c) => c.abort());
    abortControllers.current.clear();
    state.generationQueue
      .filter((r) => r.status === 'pending' || r.status === 'generating')
      .forEach((r) => dispatch({ type: 'REMOVE_GENERATION_REQUEST', payload: r.id }));
    setIsGenerating(false);
  };

  if (!activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
        Select or create a project to start generating images
      </div>
    );
  }

  // Group images by batchId
  const imageBatches = projectImages.reduce((acc, img) => {
    const batchKey = img.batchId || img.id; // Use id as fallback for old images without batchId
    if (!acc[batchKey]) {
      acc[batchKey] = [];
    }
    acc[batchKey].push(img);
    return acc;
  }, {} as Record<string, typeof projectImages>);

  // Sort batches by most recent first
  const sortedBatches = Object.entries(imageBatches).sort((a, b) => {
    const aTime = Math.max(...a[1].map(img => img.createdAt));
    const bTime = Math.max(...b[1].map(img => img.createdAt));
    return bTime - aTime;
  });

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* LEFT SIDEBAR - Prompt & Settings */}
      <div className="w-80 border-r border-border flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  startGeneration();
                }
              }}
              placeholder="Describe the image you want to generate..."
              className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-border-focus resize-none h-32"
              disabled={isGenerating || isEnhancing}
            />
            {/* AI Enhancement Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={useAiEnhancement}
                onChange={(e) => setUseAiEnhancement(e.target.checked)}
                disabled={isGenerating || isEnhancing}
                className="w-4 h-4 rounded border-border bg-surface-overlay checked:bg-accent checked:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50 cursor-pointer"
              />
              <span className="text-xs text-text-muted group-hover:text-text transition-colors">
                ✨ AI Enhance Prompt {isEnhancing && '(enhancing...)'}
              </span>
            </label>
            {enhancedPrompt && (
              <div className="p-2 bg-accent/10 border border-accent/30 rounded-lg">
                <p className="text-xs text-accent font-medium mb-1">✨ Enhanced Prompt:</p>
                <p className="text-xs text-text-muted">{enhancedPrompt}</p>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="text-xs font-medium text-text">Settings</div>
            <SettingsBar />
          </div>
        </div>

        {/* Generate Button (Sticky Bottom) */}
        <div className="p-4 border-t border-border bg-surface space-y-2">
          {!state.apiKey && (
            <p className="text-xs text-warning">Add your Gemini API key in the sidebar first</p>
          )}
          <button
            onClick={startGeneration}
            disabled={!prompt.trim() || isGenerating || isEnhancing || !state.apiKey}
            className="w-full bg-accent hover:bg-accent-hover disabled:bg-surface-overlay disabled:text-text-dim text-white text-sm font-medium px-4 py-3 rounded-lg transition-colors"
          >
            {isEnhancing ? 'Enhancing...' : isGenerating ? 'Generating...' : 'Generate'}
          </button>
          {isGenerating && (
            <button
              onClick={cancelAll}
              className="w-full text-xs text-danger hover:text-red-400 py-1"
            >
              Cancel All
            </button>
          )}
          <p className="text-xs text-text-dim text-center">
            Cmd+Enter to generate
          </p>
        </div>
      </div>

      {/* CENTER - Generated Images (Grouped by Batch) */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Active requests */}
        {activeRequests.length > 0 && (
          <div className="mb-6">
            <div className="text-xs text-text-muted mb-3">
              Generating {activeRequests.length} image{activeRequests.length > 1 ? 's' : ''}...
            </div>
            <div className="flex flex-wrap gap-4">
              {activeRequests.map((req) => (
                <div
                  key={req.id}
                  className="w-64 aspect-square bg-surface-overlay border-2 border-accent/50 rounded-lg flex items-center justify-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-text-dim">
                      {req.status === 'pending' ? 'Queued' : 'Generating'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error requests */}
        {state.generationQueue
          .filter((r) => r.status === 'error')
          .map((req) => (
            <div
              key={req.id}
              className="mb-4 bg-danger/10 border border-danger/30 rounded-lg p-3 text-xs text-danger flex justify-between items-start"
            >
              <div>
                <strong>Generation failed:</strong> {req.error}
                <div className="text-text-dim mt-0.5">Prompt: {req.prompt}</div>
              </div>
              <button
                onClick={() => dispatch({ type: 'REMOVE_GENERATION_REQUEST', payload: req.id })}
                className="text-text-dim hover:text-text ml-2 shrink-0"
              >
                ×
              </button>
            </div>
          ))}

        {/* Generated images - Grouped by batch in rows */}
        {sortedBatches.length > 0 ? (
          <div className="space-y-6">
            {sortedBatches.map(([batchKey, images]) => (
              <div key={batchKey} className="space-y-2">
                {/* Batch Header */}
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <div>
                    <span className="font-medium">{images[0].prompt}</span>
                    {images.length > 1 && <span className="ml-2">({images.length} variations)</span>}
                  </div>
                  <span>{new Date(images[0].createdAt).toLocaleString()}</span>
                </div>

                {/* Images in Row */}
                <div className="flex flex-wrap gap-4">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className={`group relative w-64 aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${
                        state.selectedImageId === img.id
                          ? 'ring-2 ring-accent shadow-lg'
                          : 'hover:ring-2 hover:ring-border-focus'
                      }`}
                      onClick={() => {
                        dispatch({ type: 'SET_SELECTED_IMAGE', payload: img.id });
                      }}
                    >
                      <img
                        src={img.dataUrl}
                        alt={img.prompt}
                        className="w-full h-full object-cover"
                      />

                      {/* Overlay Controls */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dispatch({ type: 'SET_SELECTED_IMAGE', payload: img.id });
                              dispatch({ type: 'SET_VIEW', payload: 'edit' });
                            }}
                            className="flex-1 text-xs px-3 py-1.5 bg-white/90 hover:bg-white text-black rounded transition-colors font-medium"
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
                            className="px-3 py-1.5 bg-white/90 hover:bg-white rounded transition-colors"
                            title="Download"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dispatch({ type: 'DELETE_GENERATED_IMAGE', payload: img.id });
                              deleteImageBlob(img.id).catch(() => {});
                            }}
                            className="px-3 py-1.5 bg-danger/90 hover:bg-danger text-white rounded transition-colors"
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          !isGenerating && (
            <div className="text-center text-text-dim text-sm py-20">
              No images generated yet for this project.
              <br />
              Write a prompt and hit Generate.
            </div>
          )
        )}
      </div>

      {/* RIGHT SIDEBAR - Project Context */}
      <div className="w-80 border-l border-border overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="text-xs font-medium text-text">Project Context</div>
          <ProjectSettings />
        </div>
      </div>
    </div>
  );
}
