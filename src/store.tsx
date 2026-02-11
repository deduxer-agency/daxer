import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import { v4 as uuid } from 'uuid';
import type {
  Project,
  GeneratedImage,
  GenerationRequest,
  GenerationSettings,
  ReferenceImage,
  Character,
} from './types';
import type { ModelId } from './gemini';
import {
  saveImageBlob,
  getMultipleImageBlobs,
  deleteImageBlob,
} from './db';

// ---- State ----

interface AppState {
  apiKey: string;
  modelId: ModelId;
  projects: Project[];
  activeProjectId: string | null;
  generatedImages: GeneratedImage[];
  generationQueue: GenerationRequest[];
  defaultSettings: GenerationSettings;
  selectedImageId: string | null;
  view: 'generate' | 'gallery' | 'edit';
  hydrated: boolean;
}

const DEFAULT_SETTINGS: GenerationSettings = {
  aspectRatio: '1:1',
  imageSize: '2K',
  temperature: 1,
  numberOfVariations: 3,
  stylePreset: 'none',
};

// ---- localStorage: metadata only (no image data) ----

interface SavedState {
  apiKey?: string;
  modelId?: string;
  projects?: Project[];
  activeProjectId?: string | null;
  generatedImages?: GeneratedImage[];
  defaultSettings?: GenerationSettings;
}

function loadState(): SavedState {
  try {
    const raw = localStorage.getItem('daxer-studio-state');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old projects to include characters array
      if (parsed.projects) {
        parsed.projects = parsed.projects.map((p: any) => ({
          ...p,
          characters: p.characters || [],
        }));
      }
      return parsed;
    }
  } catch {}
  return {};
}

/** Strip dataUrl from all images before saving to localStorage */
function saveState(state: AppState) {
  const projects = state.projects.map((p) => ({
    ...p,
    referenceImages: p.referenceImages.map((img) => ({
      ...img,
      dataUrl: '', // stored in IndexedDB
    })),
    characters: p.characters.map((char) => ({
      ...char,
      dataUrl: '', // stored in IndexedDB
    })),
  }));

  const generatedImages = state.generatedImages.map((img) => ({
    ...img,
    dataUrl: '', // stored in IndexedDB
  }));

  const toSave: SavedState = {
    apiKey: state.apiKey,
    modelId: state.modelId,
    projects,
    activeProjectId: state.activeProjectId,
    generatedImages,
    defaultSettings: state.defaultSettings,
  };

  try {
    localStorage.setItem('daxer-studio-state', JSON.stringify(toSave));
  } catch (err) {
    console.warn('[Daxer] localStorage save failed:', err);
  }
}

function getInitialState(): AppState {
  const saved = loadState();
  return {
    apiKey: saved.apiKey || '',
    modelId: (saved.modelId as ModelId) || 'gemini-2.5-flash-image',
    projects: saved.projects || [],
    activeProjectId: saved.activeProjectId || null,
    generatedImages: saved.generatedImages || [],
    generationQueue: [],
    defaultSettings: saved.defaultSettings || DEFAULT_SETTINGS,
    selectedImageId: null,
    view: 'generate',
    hydrated: false,
  };
}

// ---- Actions ----

type Action =
  | { type: 'SET_API_KEY'; payload: string }
  | { type: 'SET_MODEL_ID'; payload: ModelId }
  | { type: 'CREATE_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Partial<Project> & { id: string } }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'SET_ACTIVE_PROJECT'; payload: string | null }
  | { type: 'ADD_REFERENCE_IMAGE'; payload: { projectId: string; image: ReferenceImage } }
  | { type: 'ADD_REFERENCE_IMAGES_BATCH'; payload: { projectId: string; images: ReferenceImage[] } }
  | { type: 'REMOVE_REFERENCE_IMAGE'; payload: { projectId: string; imageId: string } }
  | { type: 'ADD_CHARACTER'; payload: { projectId: string; character: Character } }
  | { type: 'ADD_CHARACTERS_BATCH'; payload: { projectId: string; characters: Character[] } }
  | { type: 'REMOVE_CHARACTER'; payload: { projectId: string; characterId: string } }
  | { type: 'UPDATE_CHARACTER_LABEL'; payload: { projectId: string; characterId: string; label: string } }
  | { type: 'ADD_GENERATION_REQUEST'; payload: GenerationRequest }
  | { type: 'UPDATE_GENERATION_REQUEST'; payload: Partial<GenerationRequest> & { id: string } }
  | { type: 'REMOVE_GENERATION_REQUEST'; payload: string }
  | { type: 'ADD_GENERATED_IMAGE'; payload: GeneratedImage }
  | { type: 'DELETE_GENERATED_IMAGE'; payload: string }
  | { type: 'SET_DEFAULT_SETTINGS'; payload: Partial<GenerationSettings> }
  | { type: 'SET_SELECTED_IMAGE'; payload: string | null }
  | { type: 'SET_VIEW'; payload: 'generate' | 'gallery' | 'edit' }
  | { type: 'HYDRATE_IMAGE_BLOBS'; payload: { imageMap: Map<string, string> } };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_API_KEY':
      return { ...state, apiKey: action.payload };

    case 'SET_MODEL_ID':
      return { ...state, modelId: action.payload };

    case 'CREATE_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };

    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload, updatedAt: Date.now() } : p
        ),
      };

    case 'DELETE_PROJECT': {
      const newProjects = state.projects.filter((p) => p.id !== action.payload);
      return {
        ...state,
        projects: newProjects,
        activeProjectId:
          state.activeProjectId === action.payload
            ? newProjects[0]?.id || null
            : state.activeProjectId,
        generatedImages: state.generatedImages.filter((img) => img.projectId !== action.payload),
      };
    }

    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.payload, selectedImageId: null };

    case 'ADD_REFERENCE_IMAGE':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.projectId
            ? {
                ...p,
                referenceImages: [...p.referenceImages, action.payload.image],
                updatedAt: Date.now(),
              }
            : p
        ),
      };

    case 'ADD_REFERENCE_IMAGES_BATCH':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.projectId
            ? {
                ...p,
                referenceImages: [...p.referenceImages, ...action.payload.images],
                updatedAt: Date.now(),
              }
            : p
        ),
      };

    case 'REMOVE_REFERENCE_IMAGE':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.projectId
            ? {
                ...p,
                referenceImages: p.referenceImages.filter(
                  (img) => img.id !== action.payload.imageId
                ),
                updatedAt: Date.now(),
              }
            : p
        ),
      };

    case 'ADD_CHARACTER':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.projectId
            ? {
                ...p,
                characters: [...p.characters, action.payload.character],
                updatedAt: Date.now(),
              }
            : p
        ),
      };

    case 'ADD_CHARACTERS_BATCH':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.projectId
            ? {
                ...p,
                characters: [...p.characters, ...action.payload.characters],
                updatedAt: Date.now(),
              }
            : p
        ),
      };

    case 'REMOVE_CHARACTER':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.projectId
            ? {
                ...p,
                characters: p.characters.filter(
                  (char) => char.id !== action.payload.characterId
                ),
                updatedAt: Date.now(),
              }
            : p
        ),
      };

    case 'UPDATE_CHARACTER_LABEL':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.projectId
            ? {
                ...p,
                characters: p.characters.map((char) =>
                  char.id === action.payload.characterId
                    ? { ...char, label: action.payload.label }
                    : char
                ),
                updatedAt: Date.now(),
              }
            : p
        ),
      };

    case 'ADD_GENERATION_REQUEST':
      return { ...state, generationQueue: [...state.generationQueue, action.payload] };

    case 'UPDATE_GENERATION_REQUEST':
      return {
        ...state,
        generationQueue: state.generationQueue.map((r) =>
          r.id === action.payload.id ? { ...r, ...action.payload } : r
        ),
      };

    case 'REMOVE_GENERATION_REQUEST':
      return {
        ...state,
        generationQueue: state.generationQueue.filter((r) => r.id !== action.payload),
      };

    case 'ADD_GENERATED_IMAGE':
      return { ...state, generatedImages: [action.payload, ...state.generatedImages] };

    case 'DELETE_GENERATED_IMAGE':
      return {
        ...state,
        generatedImages: state.generatedImages.filter((img) => img.id !== action.payload),
        selectedImageId:
          state.selectedImageId === action.payload ? null : state.selectedImageId,
      };

    case 'SET_DEFAULT_SETTINGS':
      return {
        ...state,
        defaultSettings: { ...state.defaultSettings, ...action.payload },
      };

    case 'SET_SELECTED_IMAGE':
      return { ...state, selectedImageId: action.payload };

    case 'SET_VIEW':
      return { ...state, view: action.payload };

    case 'HYDRATE_IMAGE_BLOBS': {
      const { imageMap } = action.payload;

      // Restore dataUrls to reference images, characters, and generated images
      const projects = state.projects.map((p) => ({
        ...p,
        referenceImages: p.referenceImages
          .map((img) => ({
            ...img,
            dataUrl: imageMap.get(img.id) || img.dataUrl,
          }))
          // Remove references whose blobs are missing (orphaned metadata)
          .filter((img) => img.dataUrl),
        characters: p.characters
          .map((char) => ({
            ...char,
            dataUrl: imageMap.get(char.id) || char.dataUrl,
          }))
          .filter((char) => char.dataUrl),
      }));

      const generatedImages = state.generatedImages
        .map((img) => ({
          ...img,
          dataUrl: imageMap.get(img.id) || img.dataUrl,
        }))
        .filter((img) => img.dataUrl);

      return { ...state, projects, generatedImages, hydrated: true };
    }

    default:
      return state;
  }
}

// ---- Context ----

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  activeProject: Project | null;
  projectImages: GeneratedImage[];
  persistImage: (id: string, dataUrl: string) => Promise<void>;
  removePersistedImage: (id: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  // Persist metadata to localStorage (no image blobs)
  useEffect(() => {
    if (state.hydrated) {
      saveState(state);
    }
  }, [state.apiKey, state.modelId, state.projects, state.activeProjectId, state.generatedImages, state.defaultSettings, state.hydrated]);

  // On mount: hydrate image blobs from IndexedDB
  useEffect(() => {
    async function hydrate() {
      try {
        // Gather all image IDs that need hydrating
        const ids: string[] = [];
        for (const project of state.projects) {
          for (const img of project.referenceImages) {
            if (!img.dataUrl) ids.push(img.id);
          }
          for (const char of project.characters) {
            if (!char.dataUrl) ids.push(char.id);
          }
        }
        for (const img of state.generatedImages) {
          if (!img.dataUrl) ids.push(img.id);
        }

        if (ids.length > 0) {
          const imageMap = await getMultipleImageBlobs(ids);
          dispatch({ type: 'HYDRATE_IMAGE_BLOBS', payload: { imageMap } });
        } else {
          // Nothing to hydrate but mark as ready
          dispatch({ type: 'HYDRATE_IMAGE_BLOBS', payload: { imageMap: new Map() } });
        }
      } catch (err) {
        console.error('[Daxer] Failed to hydrate from IndexedDB:', err);
        dispatch({ type: 'HYDRATE_IMAGE_BLOBS', payload: { imageMap: new Map() } });
      }
    }
    hydrate();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistImage = useCallback(async (id: string, dataUrl: string) => {
    await saveImageBlob(id, dataUrl);
  }, []);

  const removePersistedImage = useCallback(async (id: string) => {
    await deleteImageBlob(id);
  }, []);

  const activeProject = state.projects.find((p) => p.id === state.activeProjectId) || null;
  const projectImages = state.generatedImages.filter(
    (img) => img.projectId === state.activeProjectId
  );

  return (
    <StoreContext.Provider
      value={{ state, dispatch, activeProject, projectImages, persistImage, removePersistedImage }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function createNewProject(name: string): Project {
  return {
    id: uuid(),
    name,
    description: '',
    stylePrompt: '',
    referenceImages: [],
    characters: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
