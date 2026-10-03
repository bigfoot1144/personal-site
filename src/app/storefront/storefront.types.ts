export type Vec3 = readonly [number, number, number];
export type StorefrontId = 'learning' | 'blog' | 'about' | 'projects';
export type StorefrontState = 'loading' | 'ready' | 'approaching' | 'navigating' | 'error';

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

/** All positions are exported glTF Y-up metres, not Blender coordinates. */
export interface StorefrontManifest {
  version: 1;
  source: string;
  background: string;
  assets: {
    desktop: { url: string; bytes: number };
    mobile: { url: string; bytes: number };
    poster: { url: string; width: number; height: number };
    environment?: string;
  };
  bounds: Bounds;
  overview: CameraPose;
  storefronts: Array<{
    id: StorefrontId;
    hitBox: Bounds;
    focus: CameraPose;
    sign: { position: Vec3; width: number; height: number };
  }>;
}

export const STOREFRONT_DESTINATIONS: Readonly<Record<StorefrontId, {
  href: string;
  label: string;
  name: string;
  external: boolean;
}>> = {
  learning: { href: '/knowledge', label: 'Learning — explore knowledge', name: 'Learning', external: false },
  blog: { href: '/blog', label: 'Blog — read the journal', name: 'Blog', external: false },
  about: { href: '/about', label: 'About — meet Bigfoot', name: 'About', external: false },
  projects: { href: 'https://github.com/bigfoot1144', label: 'Projects — Bigfoot on GitHub', name: 'Projects', external: true }
};

export const STOREFRONT_IDS: readonly StorefrontId[] = ['learning', 'blog', 'about', 'projects'];
export const APPROACH_DURATION_MS = 900;
export const LOAD_TIMEOUT_MS = 20_000;

export interface StorefrontClock {
  now(): number;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
  setTimeout(callback: () => void, milliseconds: number): number;
  clearTimeout(id: number): void;
}

export interface ShopProjection {
  id: StorefrontId;
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface RuntimeMetrics {
  calls: number;
  triangles: number;
  frames: number;
  camera: Vec3;
  fov: number;
  pan: number;
}

export interface StorefrontRuntime {
  approach(id: StorefrontId, duration: number): Promise<boolean>;
  cancelApproach(): void;
  resetOverview(): void;
  focusShop(id: StorefrontId): void;
  pick(clientX: number, clientY: number): StorefrontId | null;
  dispose(): void;
}

export interface StorefrontRuntimeOptions {
  canvas: HTMLCanvasElement;
  surface: HTMLElement;
  manifest: StorefrontManifest;
  signal: AbortSignal;
  clock: StorefrontClock;
  onFirstFrame(): void;
  onError(error: unknown): void;
  onProjection(projections: readonly ShopProjection[]): void;
  onHover(id: StorefrontId | null): void;
  onActivate(id: StorefrontId, event: MouseEvent): void;
  onMetrics(metrics: RuntimeMetrics): void;
}

export type StorefrontRuntimeFactory = (options: StorefrontRuntimeOptions) => Promise<StorefrontRuntime>;
