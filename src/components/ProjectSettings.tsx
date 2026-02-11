import { useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useStore } from '../store';
import { compressImages } from '../imageUtils';
import { saveMultipleImageBlobs, deleteImageBlob } from '../db';
import { Lightbox } from './Lightbox';
import type { Character } from '../types';

const MAX_REFERENCES = 20;
const MAX_CHARACTERS = 20;

function isCharacter(item: any): item is Character {
  return 'label' in item;
}

export function ProjectSettings() {
  const { activeProject, dispatch } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const characterFileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');

  if (!activeProject) return null;

  const remaining = MAX_REFERENCES - activeProject.referenceImages.length;
  const charactersRemaining = MAX_CHARACTERS - activeProject.characters.length;

  const lightboxItem = lightboxImage
    ? activeProject.referenceImages.find((img) => img.id === lightboxImage) ||
      activeProject.characters.find((char) => char.id === lightboxImage)
    : null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const selected = Array.from(files).slice(0, remaining);
    if (selected.length === 0) return;

    setUploading(true);
    setUploadProgress(`Processing 0/${selected.length}...`);

    try {
      const compressed = await compressImages(selected, (done, total, name) => {
        if (done < total) {
          setUploadProgress(`Compressing ${done + 1}/${total}: ${name}`);
        } else {
          setUploadProgress('Saving...');
        }
      });

      if (compressed.length === 0) {
        setUploadProgress('');
        setUploading(false);
        return;
      }

      const newImages = compressed.map((c) => ({
        id: uuid(),
        name: c.name,
        dataUrl: c.dataUrl,
        mimeType: c.mimeType,
      }));

      await saveMultipleImageBlobs(
        newImages.map((img) => ({ id: img.id, dataUrl: img.dataUrl }))
      );

      dispatch({
        type: 'ADD_REFERENCE_IMAGES_BATCH',
        payload: { projectId: activeProject.id, images: newImages },
      });

      setUploadProgress('');
    } catch (err) {
      console.error('[Daxer] Upload failed:', err);
      setUploadProgress('Upload failed. Try fewer images.');
      setTimeout(() => setUploadProgress(''), 3000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (imageId: string) => {
    dispatch({
      type: 'REMOVE_REFERENCE_IMAGE',
      payload: { projectId: activeProject.id, imageId },
    });
    try {
      await deleteImageBlob(imageId);
    } catch {}
  };

  const handleCharacterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const selected = Array.from(files).slice(0, charactersRemaining);
    if (selected.length === 0) return;

    setUploading(true);
    setUploadProgress(`Processing 0/${selected.length}...`);

    try {
      const compressed = await compressImages(selected, (done, total, name) => {
        if (done < total) {
          setUploadProgress(`Compressing ${done + 1}/${total}: ${name}`);
        } else {
          setUploadProgress('Saving...');
        }
      });

      if (compressed.length === 0) {
        setUploadProgress('');
        setUploading(false);
        return;
      }

      const newCharacters = compressed.map((c, index) => ({
        id: uuid(),
        label: `Character ${activeProject.characters.length + index + 1}`,
        name: c.name,
        dataUrl: c.dataUrl,
        mimeType: c.mimeType,
      }));

      await saveMultipleImageBlobs(
        newCharacters.map((char) => ({ id: char.id, dataUrl: char.dataUrl }))
      );

      dispatch({
        type: 'ADD_CHARACTERS_BATCH',
        payload: { projectId: activeProject.id, characters: newCharacters },
      });

      setUploadProgress('');
    } catch (err) {
      console.error('[Daxer] Character upload failed:', err);
      setUploadProgress('Upload failed. Try fewer images.');
      setTimeout(() => setUploadProgress(''), 3000);
    } finally {
      setUploading(false);
      if (characterFileInputRef.current) characterFileInputRef.current.value = '';
    }
  };

  const handleRemoveCharacter = async (characterId: string) => {
    dispatch({
      type: 'REMOVE_CHARACTER',
      payload: { projectId: activeProject.id, characterId },
    });
    try {
      await deleteImageBlob(characterId);
    } catch {}
  };

  const handleUpdateLabel = (characterId: string, newLabel: string) => {
    if (newLabel.trim()) {
      dispatch({
        type: 'UPDATE_CHARACTER_LABEL',
        payload: { projectId: activeProject.id, characterId, label: newLabel.trim() },
      });
    }
    setEditingLabelId(null);
    setLabelInput('');
  };

  return (
    <div className="bg-surface-raised border border-border rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-text">Project Context</h3>

      {/* Description */}
      <div>
        <label className="text-xs text-text-muted block mb-1">Description</label>
        <textarea
          value={activeProject.description}
          onChange={(e) =>
            dispatch({
              type: 'UPDATE_PROJECT',
              payload: { id: activeProject.id, description: e.target.value },
            })
          }
          placeholder="What is this project about? This context will be included in every generation..."
          className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-border-focus resize-none h-20"
        />
      </div>

      {/* Style Prompt */}
      <div>
        <label className="text-xs text-text-muted block mb-1">Style Prompt</label>
        <textarea
          value={activeProject.stylePrompt}
          onChange={(e) =>
            dispatch({
              type: 'UPDATE_PROJECT',
              payload: { id: activeProject.id, stylePrompt: e.target.value },
            })
          }
          placeholder="Define the visual style: e.g., 'minimalist flat design, pastel colors, clean lines, modern illustration style'"
          className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-border-focus resize-none h-20"
        />
      </div>

      {/* Reference Images */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-text-muted">
            Reference Images ({activeProject.referenceImages.length}/{MAX_REFERENCES})
          </label>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={remaining <= 0 || uploading}
            className="text-xs text-accent hover:text-accent-hover disabled:text-text-dim disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : '+ Add Images'}
          </button>
        </div>

        {uploadProgress && (
          <div className="mb-2 text-xs text-accent bg-accent-muted rounded-lg px-3 py-1.5 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
            {uploadProgress}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />

        {activeProject.referenceImages.length === 0 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-border hover:border-border-focus rounded-lg py-6 text-center text-xs text-text-dim hover:text-text-muted transition-colors disabled:opacity-50"
          >
            Drop or click to add reference images for style consistency
          </button>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {activeProject.referenceImages.map((img) => (
              <div key={img.id} className="relative group aspect-square">
                {img.dataUrl ? (
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-full h-full object-cover rounded-lg border border-border cursor-pointer hover:border-border-focus transition-colors"
                    onClick={() => setLightboxImage(img.id)}
                    title="Click to view full size"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg border border-border bg-surface-overlay flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-text-dim border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <button
                  onClick={() => handleRemove(img.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white px-1 py-0.5 rounded-b-lg truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {img.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Character References */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-text-muted">
            Character References ({activeProject.characters.length}/{MAX_CHARACTERS})
          </label>
          <button
            onClick={() => characterFileInputRef.current?.click()}
            disabled={charactersRemaining <= 0 || uploading}
            className="text-xs text-accent hover:text-accent-hover disabled:text-text-dim disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : '+ Add Characters'}
          </button>
        </div>

        <input
          ref={characterFileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleCharacterUpload}
          className="hidden"
        />

        {activeProject.characters.length === 0 ? (
          <button
            onClick={() => characterFileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-border hover:border-border-focus rounded-lg py-6 text-center text-xs text-text-dim hover:text-text-muted transition-colors disabled:opacity-50"
          >
            Add character reference images for consistent character appearance
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {activeProject.characters.map((char) => (
              <div key={char.id} className="relative group">
                {char.dataUrl ? (
                  <div className="aspect-[3/4] relative">
                    <img
                      src={char.dataUrl}
                      alt={char.label}
                      className="w-full h-full object-cover rounded-lg border border-border cursor-pointer hover:border-border-focus transition-colors"
                      onClick={() => setLightboxImage(char.id)}
                      title="Click to view full size"
                    />
                    <button
                      onClick={() => handleRemoveCharacter(char.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <div className="aspect-[3/4] rounded-lg border border-border bg-surface-overlay flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-text-dim border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                <div className="mt-1">
                  {editingLabelId === char.id ? (
                    <input
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      onBlur={() => handleUpdateLabel(char.id, labelInput)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateLabel(char.id, labelInput);
                        if (e.key === 'Escape') {
                          setEditingLabelId(null);
                          setLabelInput('');
                        }
                      }}
                      autoFocus
                      className="w-full bg-surface-overlay border border-border-focus rounded px-2 py-1 text-xs text-text outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingLabelId(char.id);
                        setLabelInput(char.label);
                      }}
                      className="w-full text-left text-xs text-text-muted hover:text-text truncate px-1 py-1 rounded hover:bg-surface-overlay"
                      title="Click to edit label"
                    >
                      {char.label}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxItem && (
        <Lightbox
          imageUrl={lightboxItem.dataUrl}
          alt={isCharacter(lightboxItem) ? lightboxItem.label : lightboxItem.name}
          onClose={() => setLightboxImage(null)}
          details={{
            title: isCharacter(lightboxItem) ? lightboxItem.label : lightboxItem.name,
            subtitle: isCharacter(lightboxItem) ? 'Character Reference' : 'Reference Image',
          }}
          actions={
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = lightboxItem.dataUrl;
                a.download = isCharacter(lightboxItem) ? lightboxItem.label : lightboxItem.name;
                a.click();
              }}
              className="bg-surface-overlay hover:bg-surface-raised text-white text-xs px-3 py-1.5 rounded-lg border border-border"
            >
              Download
            </button>
          }
        />
      )}
    </div>
  );
}
