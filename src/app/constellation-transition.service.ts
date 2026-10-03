import { Injectable } from '@angular/core';

export interface ConstellationMorphStar {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface KnowledgeCameraState {
  scale: number;
  panX: number;
  panY: number;
  parallaxX: number;
  parallaxY: number;
  viewportWidth: number;
  viewportHeight: number;
  parallaxActive: boolean;
}

interface StarTransitionRenderer {
  morphToConstellation(targets: ConstellationMorphStar[]): Promise<void>;
  scatterToRandom(origins: ConstellationMorphStar[]): void;
  updateKnowledgeCamera(state: KnowledgeCameraState): void;
  cancelTransition(): void;
}

interface PendingMorph {
  targets: ConstellationMorphStar[];
  resolve: () => void;
}

@Injectable({ providedIn: 'root' })
export class ConstellationTransitionService {
  private renderer: StarTransitionRenderer | null = null;
  private snapshotProvider: (() => ConstellationMorphStar[]) | null = null;
  private exitSnapshot: ConstellationMorphStar[] = [];
  private pendingMorph: PendingMorph | null = null;
  private pendingCamera: KnowledgeCameraState | null = null;

  registerRenderer(renderer: StarTransitionRenderer): () => void {
    if (this.renderer && this.renderer !== renderer) this.cancelKnowledgeTransition();
    this.renderer = renderer;
    if (this.pendingCamera) renderer.updateKnowledgeCamera(this.pendingCamera);
    if (this.pendingMorph) this.startMorph(renderer, this.pendingMorph);
    return () => {
      if (this.renderer !== renderer) return;
      this.cancelKnowledgeTransition();
      this.renderer = null;
    };
  }

  registerSnapshotProvider(provider: () => ConstellationMorphStar[]): () => void {
    this.snapshotProvider = provider;
    return () => {
      if (this.snapshotProvider === provider) this.snapshotProvider = null;
    };
  }

  morphToConstellation(targets: ConstellationMorphStar[]): Promise<void> {
    this.finishPendingMorph();
    this.renderer?.cancelTransition();
    if (!targets.length) return Promise.resolve();
    return new Promise(resolve => {
      const request: PendingMorph = { targets, resolve };
      this.pendingMorph = request;
      // The knowledge view can render before the background's browser-only initialization.
      if (this.renderer) this.startMorph(this.renderer, request);
    });
  }

  updateKnowledgeCamera(state: KnowledgeCameraState): void {
    this.pendingCamera = state;
    this.renderer?.updateKnowledgeCamera(state);
  }

  captureExitSnapshot(): void {
    this.exitSnapshot = this.snapshotProvider?.() ?? [];
  }

  discardExitSnapshot(): void {
    this.exitSnapshot = [];
  }

  scatterFromKnowledge(): void {
    this.cancelKnowledgeTransition();
    this.renderer?.scatterToRandom(this.exitSnapshot);
    this.discardExitSnapshot();
  }

  cancelKnowledgeTransition(): void {
    this.finishPendingMorph();
    this.pendingCamera = null;
    this.renderer?.cancelTransition();
  }

  reset(): void {
    this.cancelKnowledgeTransition();
    this.renderer = null;
    this.snapshotProvider = null;
    this.discardExitSnapshot();
  }

  private startMorph(renderer: StarTransitionRenderer, request: PendingMorph): void {
    const finish = () => {
      // A late completion must not resolve or clear a newer view's transition.
      if (this.pendingMorph === request) this.finishPendingMorph();
    };
    try {
      // A failed cosmetic transition must not leave the knowledge page invisible.
      void renderer.morphToConstellation(request.targets).then(finish, finish);
    } catch {
      finish();
    }
  }

  private finishPendingMorph(): void {
    const pending = this.pendingMorph;
    this.pendingMorph = null;
    pending?.resolve();
  }
}
