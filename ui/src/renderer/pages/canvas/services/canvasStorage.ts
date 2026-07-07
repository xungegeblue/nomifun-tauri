//! Canvas storage — localStorage CRUD for canvas data.

import type { CanvasData } from '@common/types/canvas/canvasTypes';

const CANVAS_KEY_PREFIX = 'nomifun_canvas_';

export function generateCanvasId(): string {
  return `canvas_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveCanvas(canvas: CanvasData): void {
  try {
    localStorage.setItem(
      `${CANVAS_KEY_PREFIX}${canvas.id}`,
      JSON.stringify(canvas)
    );
  } catch (e) {
    console.error('Failed to save canvas:', e);
  }
}

export function loadCanvas(canvasId: string): CanvasData | null {
  try {
    const raw = localStorage.getItem(`${CANVAS_KEY_PREFIX}${canvasId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Failed to load canvas:', e);
    return null;
  }
}

export function listCanvases(): CanvasData[] {
  const canvases: CanvasData[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CANVAS_KEY_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            canvases.push(JSON.parse(raw));
          } catch {
            // skip corrupted entries
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to list canvases:', e);
  }
  return canvases.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteCanvas(canvasId: string): void {
  localStorage.removeItem(`${CANVAS_KEY_PREFIX}${canvasId}`);
}
