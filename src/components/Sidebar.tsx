import { useState } from 'react';
import { useStore, createNewProject } from '../store';
import { deleteMultipleImageBlobs } from '../db';

export function Sidebar() {
  const { state, dispatch, activeProject } = useStore();
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(state.projects.length === 0);
  const [editingProject, setEditingProject] = useState<string | null>(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const project = createNewProject(name);
    dispatch({ type: 'CREATE_PROJECT', payload: project });
    dispatch({ type: 'SET_ACTIVE_PROJECT', payload: project.id });
    setNewName('');
    setShowCreate(false);
  };

  return (
    <aside className="w-64 bg-surface-raised border-r border-border flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-text">Daxer Studio</h1>
            <p className="text-[10px] text-text-dim">Image Generation Suite</p>
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-text-dim uppercase tracking-wider">
              Projects
            </span>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="w-5 h-5 rounded bg-surface-overlay hover:bg-accent text-text-dim hover:text-white flex items-center justify-center text-xs transition-colors"
              title="New Project"
            >
              +
            </button>
          </div>

          {showCreate && (
            <div className="mb-3 space-y-1.5">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Project name..."
                className="w-full bg-surface-overlay border border-border rounded-lg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent placeholder:text-text-dim"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="w-full bg-accent hover:bg-accent-hover disabled:bg-surface-overlay disabled:text-text-dim text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                Create Project
              </button>
            </div>
          )}

          {state.projects.length === 0 && !showCreate && (
            <div className="py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-surface-overlay mx-auto mb-2 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-dim">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-xs text-text-dim">No projects yet</p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-xs text-accent hover:text-accent-hover mt-1"
              >
                Create your first project
              </button>
            </div>
          )}

          <div className="space-y-0.5">
            {state.projects.map((project) => (
              <div
                key={project.id}
                className={`group flex items-center rounded-lg cursor-pointer transition-colors ${
                  project.id === state.activeProjectId
                    ? 'bg-accent-muted text-accent'
                    : 'hover:bg-surface-overlay text-text-muted hover:text-text'
                }`}
              >
                {editingProject === project.id ? (
                  <input
                    type="text"
                    defaultValue={project.name}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val) {
                        dispatch({
                          type: 'UPDATE_PROJECT',
                          payload: { id: project.id, name: val },
                        });
                      }
                      setEditingProject(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingProject(null);
                    }}
                    className="flex-1 bg-transparent border border-accent rounded px-2 py-1.5 text-sm outline-none"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => dispatch({ type: 'SET_ACTIVE_PROJECT', payload: project.id })}
                    onDoubleClick={() => setEditingProject(project.id)}
                    className="flex-1 text-left px-3 py-1.5 text-sm truncate"
                  >
                    {project.name}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Delete "${project.name}"?`)) {
                      const refIds = project.referenceImages.map((r) => r.id);
                      const genIds = state.generatedImages
                        .filter((img) => img.projectId === project.id)
                        .map((img) => img.id);
                      const allIds = [...refIds, ...genIds];
                      if (allIds.length > 0) {
                        deleteMultipleImageBlobs(allIds).catch(() => {});
                      }
                      dispatch({ type: 'DELETE_PROJECT', payload: project.id });
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-danger px-2 py-1 text-xs transition-opacity"
                  title="Delete project"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      {activeProject && (
        <div className="p-3 border-t border-border space-y-0.5">
          {([
            { key: 'generate' as const, label: 'Generate', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
            { key: 'gallery' as const, label: 'Gallery', icon: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 2v3M16 2v3M3 10h18' },
            { key: 'edit' as const, label: 'Edit Image', icon: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: key })}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                state.view === key
                  ? 'bg-accent-muted text-accent'
                  : 'text-text-muted hover:bg-surface-overlay hover:text-text'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon} />
              </svg>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* API Key */}
      <div className="p-3 border-t border-border">
        <label className="text-[10px] font-semibold text-text-dim uppercase tracking-wider block mb-1.5">
          Gemini API Key
        </label>
        <input
          type="password"
          value={state.apiKey}
          onChange={(e) => dispatch({ type: 'SET_API_KEY', payload: e.target.value })}
          placeholder="Paste your API key..."
          className="w-full bg-surface-overlay border border-border rounded-lg px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent font-mono placeholder:text-text-dim"
        />
        <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${state.apiKey ? 'text-success' : 'text-text-dim'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${state.apiKey ? 'bg-success' : 'bg-text-dim'}`} />
          {state.apiKey ? 'Key configured' : 'Required to generate'}
        </div>
      </div>
    </aside>
  );
}
