# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daxer Studio is an AI-powered image generation application built with React, TypeScript, and Vite. It uses Google's Gemini AI API to generate and edit images based on user prompts, project context, and reference images.

## Development Commands

All commands should be run from the `Daxer/` directory:

```bash
cd Daxer

# Start development server (localhost:5173)
npm run dev

# Type-check and build for production
npm run build

# Lint code with ESLint
npm run lint

# Preview production build
npm run preview
```

## Architecture

### State Management (`src/store.tsx`)

The app uses a custom React Context + useReducer pattern for global state management:

- **StoreProvider** wraps the entire app and provides centralized state
- **useStore** hook accesses state and dispatch from any component
- State includes: projects, generated images, generation queue, settings, active project, current view
- **Hydration system**: On mount, loads image blobs from IndexedDB and merges them with metadata from localStorage
- Automatic persistence: State changes trigger saves to localStorage (metadata only, no image data)

### Dual Storage System

**localStorage** (`src/store.tsx`):
- Stores settings, project metadata, image metadata
- Image `dataUrl` fields are stripped before saving (set to empty string)
- Limited to ~5-10MB, so no actual image data stored here

**IndexedDB** (`src/db.ts`):
- Stores all image blobs as base64 dataUrls
- No practical size limit
- `saveImageBlob(id, dataUrl)` - save single image
- `getMultipleImageBlobs(ids)` - batch retrieve on hydration
- `deleteImageBlob(id)` - cleanup when deleting images

**Data flow:**
1. On app mount: Load metadata from localStorage → fetch image blobs from IndexedDB → hydrate state
2. When adding images: Save blob to IndexedDB → add metadata to state → auto-persist metadata to localStorage
3. When deleting images: Remove from state → delete blob from IndexedDB → auto-persist to localStorage

### API Layer (`src/gemini.ts`)

Handles communication with Google Gemini API:

- **Available models**: `gemini-2.5-flash-image`, `gemini-3-pro-image-preview`
- **generateImage()**: Main function for image generation
  - Builds prompt from: user prompt + project style + project description
  - Attaches reference images and optional source image (for edits)
  - Uses `responseModalities: ['TEXT', 'IMAGE']` to request image output
  - Handles safety blocks and error cases
- **Image format**: Base64-encoded in response, converted to data URLs
- API key stored in state and persisted to localStorage

### Component Architecture

**Main views** (panel-based, switch via `state.view`):
- `GenerationPanel` - Create new images from prompts
- `GalleryPanel` - Browse generated images in current project
- `EditPanel` - Edit existing images with new prompts

**Core components**:
- `Sidebar` - Project navigation and creation
- `SettingsBar` - Generation settings (aspect ratio, size, temperature, variations)
- `ProjectSettings` - Edit project name, description, style prompt, reference images
- `ErrorBoundary` - Top-level error catching

### Types (`src/types.ts`)

Core data structures:
- **Project**: Container for related images, has name, description, stylePrompt, referenceImages
- **ReferenceImage**: User-uploaded images to guide style/composition
- **GeneratedImage**: AI-generated images, linked to a project and optional parent image
- **GenerationRequest**: Tracks in-progress generation (pending/generating/completed/error)
- **GenerationSettings**: aspectRatio, imageSize, temperature, numberOfVariations

### Image Processing (`src/imageUtils.ts`)

- `compressImage(file)` - Resize to max 768px (sufficient for Gemini API), convert to JPEG/PNG
- `compressImages(files, onProgress)` - Batch process with progress callbacks
- Compression prevents memory issues and keeps storage reasonable

## Key Patterns

### Adding Reference Images to a Project

1. User selects files → `compressImages()` to resize/optimize
2. For each compressed image:
   - Generate UUID
   - Save blob to IndexedDB via `persistImage(id, dataUrl)`
   - Dispatch `ADD_REFERENCE_IMAGE` action with metadata
3. State update triggers localStorage save (without dataUrl)

### Generating Images

1. User enters prompt → `ADD_GENERATION_REQUEST` to queue
2. GenerationPanel processes queue (1 at a time)
3. For each request:
   - Call `generateImage()` with prompt, project, settings, model
   - API returns base64 image → convert to dataUrl
   - Save to IndexedDB
   - `ADD_GENERATED_IMAGE` to state
   - `REMOVE_GENERATION_REQUEST` from queue
4. Generated images shown in GalleryPanel

### Editing Images

1. User selects image from gallery → switches to EditPanel
2. EditPanel loads selected image, allows new prompt
3. On generate: Pass original image as `sourceImage` to `generateImage()`
4. New image saved with `parentImageId` linking to original

### Project Management

- Projects are containers for related work
- Each project has independent referenceImages, stylePrompt, description
- Generated images are filtered by `projectId`
- Deleting a project removes all associated generated images and reference images

## Important Notes

- **Never commit API keys**: API key is stored in localStorage only, never in code
- **Image IDs are UUIDs**: Used as keys for both state arrays and IndexedDB
- **State hydration is async**: App shows loading spinner until `state.hydrated === true`
- **Orphaned blobs**: If IndexedDB has a blob but no metadata in state, it's ignored during hydration
- **Parent-child relationships**: Edited images track their source via `parentImageId`
- **Generation queue**: Only one generation runs at a time to avoid rate limits/memory issues
- **Error handling**: API errors are captured in GenerationRequest.error field, displayed to user