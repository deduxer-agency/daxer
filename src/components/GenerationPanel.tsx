import { useState, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useStore } from '../store';
import { generateImage } from '../gemini';
import { saveImageBlob, deleteImageBlob } from '../db';
import { SettingsBar } from './SettingsBar';
import { ProjectSettings } from './ProjectSettings';
import type { GenerationSettings } from '../types';

export function GenerationPanel() {
  const { state, dispatch, activeProject, projectImages } = useStore();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const activeRequests = state.generationQueue.filter(
    (r) => r.status === 'pending' || r.status === 'generating'
  );

  const startGeneration = useCallback(async () => {
    if (!prompt.trim() || !activeProject || !state.apiKey) return;

    const settings: GenerationSettings = { ...state.defaultSettings };
    const count = settings.numberOfVariations;
    const currentPrompt = prompt.trim();
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
          controller.signal
        );

        // Persist to IndexedDB, then add to state
        await saveImageBlob(result.id, result.dataUrl);
        dispatch({ type: 'ADD_GENERATED_IMAGE', payload: result });
        dispatch({
          type: 'UPDATE_GENERATION_REQUEST',
          payload: { id: reqId, status: 'completed', result },
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
  }, [prompt, activeProject, state.apiKey, state.modelId, state.defaultSettings, dispatch]);

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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top: Project Settings */}
      <div className="p-4 border-b border-border overflow-y-auto max-h-[45vh]">
        <ProjectSettings />
      </div>

      {/* Middle: Generation Settings */}
      <div className="px-4 py-3 border-b border-border">
        <SettingsBar />
      </div>

      {/* Prompt Input */}
      <div className="p-4 border-b border-border">
        <div className="flex gap-2">
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
            className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-border-focus resize-none h-16"
            disabled={isGenerating}
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={startGeneration}
              disabled={!prompt.trim() || isGenerating || !state.apiKey}
              className="bg-accent hover:bg-accent-hover disabled:bg-surface-overlay disabled:text-text-dim text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors flex-1"
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
            {isGenerating && (
              <button
                onClick={cancelAll}
                className="text-xs text-danger hover:text-red-400 py-1"
              >
                Cancel All
              </button>
            )}
          </div>
        </div>
        {!state.apiKey && (
          <p className="text-xs text-warning mt-1">Add your Gemini API key in the sidebar first</p>
        )}
        <p className="text-xs text-text-dim mt-1">
          Cmd+Enter to generate &middot; {state.defaultSettings.numberOfVariations} variations
        </p>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Active requests */}
        {activeRequests.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-text-muted mb-2">
              Generating {activeRequests.length} image{activeRequests.length > 1 ? 's' : ''}...
            </div>
            <div className="grid grid-cols-3 gap-3">
              {activeRequests.map((req) => (
                <div
                  key={req.id}
                  className="aspect-square bg-surface-overlay border border-border rounded-xl flex items-center justify-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
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
              className="mb-3 bg-danger/10 border border-danger/30 rounded-lg p-3 text-xs text-danger flex justify-between items-start"
            >
              <div>
                <strong>Generation failed:</strong> {req.error}
                <div className="text-text-dim mt-0.5">Prompt: {req.prompt}</div>
              </div>
              <button
                onClick={() => dispatch({ type: 'REMOVE_GENERATION_REQUEST', payload: req.id })}
                className="text-text-dim hover:text-text ml-2 shrink-0"
              >
                x
              </button>
            </div>
          ))}

        {/* Generated images */}
        {projectImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {projectImages.map((img) => (
              <div
                key={img.id}
                className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                  state.selectedImageId === img.id
                    ? 'border-accent shadow-lg shadow-accent/20'
                    : 'border-border hover:border-border-focus'
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
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: 'SET_SELECTED_IMAGE', payload: img.id });
                        dispatch({ type: 'SET_VIEW', payload: 'edit' });
                      }}
                      className="text-[10px] text-accent hover:text-accent-hover"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: 'DELETE_GENERATED_IMAGE', payload: img.id });
                        deleteImageBlob(img.id).catch(() => {});
                      }}
                      className="text-[10px] text-text-dim hover:text-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !isGenerating && (
            <div className="text-center text-text-dim text-sm py-12">
              No images generated yet for this project.
              <br />
              Write a prompt and hit Generate.
            </div>
          )
        )}
      </div>
    </div>
  );
}
