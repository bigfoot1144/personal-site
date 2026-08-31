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
}

@Injectable({ providedIn: 'root' })
export class ConstellationTransitionService {
  private renderer: StarTransitionRenderer | null = null;
  private snapshotProvider: (() => ConstellationMorphStar[]) | null = null;
  private exitSnapshot: ConstellationMorphStar[] = [];
  private pendingTargets: ConstellationMorphStar[] | null = null;
  private pendingCamera: KnowledgeCameraState | null = null;

  registerRenderer(renderer: StarTransitionRenderer): () => void {
    this.renderer = renderer;
    if (this.pendingCamera) renderer.updateKnowledgeCamera(this.pendingCamera);
    if (this.pendingTargets) {
      void renderer.morphToConstellation(this.pendingTargets);
      this.pendingTargets = null;
    }
    return () => {
      if (this.renderer === renderer) this.renderer = null;
    };
  }

  registerSnapshotProvider(provider: () => ConstellationMorphStar[]): () => void {
    this.snapshotProvider = provider;
    return () => {
      if (this.snapshotProvider === provider) this.snapshotProvider = null;
    };
  }

  morphToConstellation(targets: ConstellationMorphStar[]): Promise<void> {
    if (this.renderer) return this.renderer.morphToConstellation(targets);
    this.pendingTargets = targets;
    return Promise.resolve();
  }

  updateKnowledgeCamera(state: KnowledgeCameraState): void {
    this.pendingCamera = state;
    this.renderer?.updateKnowledgeCamera(state);
  }

  captureExitSnapshot(): void {
    this.exitSnapshot = this.snapshotProvider?.() ?? [];
  }

  scatterFromKnowledge(): void {
    this.renderer?.scatterToRandom(this.exitSnapshot);
    this.exitSnapshot = [];
    this.pendingCamera = null;
  }
}
