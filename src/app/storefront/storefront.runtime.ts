// This module is imported only by the browser's afterNextRender callback.
import {
  AgXToneMapping, Box3, Color, EquirectangularReflectionMapping, Material, Mesh,
  Object3D, PerspectiveCamera, Raycaster, Scene, Skeleton, SRGBColorSpace,
  Texture, TextureLoader, Vector2, Vector3, WebGLRenderer
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  boundsCorners, clamp, fitPose, interpolatePose, overviewFrame,
  panAfterResize, panForShop, plainActivation, pointerNdc, PointerGesture
} from './storefront.math';
import type {
  CameraPose, ShopProjection, StorefrontId, StorefrontRuntime, StorefrontRuntimeOptions
} from './storefront.types';

/** Dispose unique GPU resources and CPU ImageBitmaps, including late GLTF results. */
export function disposeObjectTree(input: Object3D | readonly Object3D[]): void {
  const roots: readonly Object3D[] = Array.isArray(input) ? input : [input as Object3D];
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const images = new Set<ImageBitmap>();
  const skeletons = new Set<Skeleton>();
  for (const root of roots) root.traverse(object => {
    const mesh = object as Mesh & { skeleton?: Skeleton };
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of list) materials.add(material);
    }
    if (mesh.skeleton) skeletons.add(mesh.skeleton);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
  }
  for (const texture of textures) {
    const image = texture.source?.data as { close?: () => void } | undefined;
    if (image && typeof image.close === 'function') images.add(image as ImageBitmap);
    texture.dispose();
  }
  for (const image of images) image.close();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
  for (const root of roots) root.clear();
}

interface Travel {
  from: CameraPose;
  to: CameraPose;
  started: number;
  duration: number;
  resolve(completed: boolean): void;
}

class ThreeStorefrontRuntime implements StorefrontRuntime {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera();
  private readonly raycaster = new Raycaster();
  private readonly hitPoint = new Vector3();
  private readonly gesture = new PointerGesture();
  private readonly renderer: WebGLRenderer;
  private readonly ktx2: KTX2Loader;
  private readonly loader: GLTFLoader;
  private readonly boxes: Array<{ id: StorefrontId; box: Box3 }>;
  private readonly removers: Array<() => void> = [];
  private readonly view: Window;
  private readonly document: Document;
  private readonly fetchAbort = new AbortController();
  private resizeObserver: ResizeObserver | null = null;
  private frame: number | null = null;
  private travel: Travel | null = null;
  private pose: CameraPose;
  private pan: number | undefined;
  private width = 1;
  private height = 1;
  private ready = false;
  private disposed = false;
  private firstFrame = false;
  private frames = 0;
  private hovered: StorefrontId | null = null;
  private environment: Texture | null = null;
  private loadedScenes: Object3D[] = [];
  private mobile = false;

  constructor(private readonly options: StorefrontRuntimeOptions) {
    this.document = options.canvas.ownerDocument;
    this.view = this.document.defaultView!;
    this.pose = options.manifest.overview;
    this.scene.background = new Color(options.manifest.background);
    this.renderer = new WebGLRenderer({ canvas: options.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    // Live PBR uses AgX; display-toned baked surfaces opt out below.
    this.renderer.toneMapping = AgXToneMapping;
    this.ktx2 = new KTX2Loader().setTranscoderPath('/assets/storefront/basis/').detectSupport(this.renderer);
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(this.ktx2);
    this.boxes = options.manifest.storefronts.map(shop => ({
      id: shop.id,
      box: new Box3(new Vector3(...shop.hitBox.min), new Vector3(...shop.hitBox.max))
    }));
    this.installListeners();
    this.resize();
    void this.load();
  }

  private get overview() {
    return overviewFrame(this.options.manifest, this.width, this.height, this.pan);
  }

  private get usable(): boolean { return !this.disposed && !this.options.signal.aborted; }

  private async load(): Promise<void> {
    try {
      const asset = this.options.manifest.assets[this.mobile ? 'mobile' : 'desktop'];
      const url = new URL(asset.url, this.document.baseURI);
      const response = await fetch(url, { signal: this.fetchAbort.signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Storefront GLB returned ${response.status}`);
      const data = await response.arrayBuffer();
      if (!this.usable) return;
      const gltf = await this.loader.parseAsync(data, new URL('.', url).href);
      if (!this.usable) {
        disposeObjectTree(gltf.scenes);
        return;
      }
      this.loadedScenes = gltf.scenes;
      this.scene.add(gltf.scene);
      // The exported default scene is the entire street. Never generate substitute geometry.
      gltf.scene.traverse(object => {
        const mesh = object as Mesh;
        if (!mesh.material) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if ((material as Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial || material.userData['bakedDisplayTone'] === true) {
            material.toneMapped = false;
          }
        }
      });
      const environmentUrl = this.options.manifest.assets.environment;
      if (environmentUrl) {
        const texture = await this.loadEnvironment(new URL(environmentUrl, this.document.baseURI).href);
        if (!this.usable) { texture.dispose(); return; }
        texture.mapping = EquirectangularReflectionMapping;
        this.environment = texture;
        this.scene.environment = texture;
      }
      if (!this.usable) return;
      this.scene.updateMatrixWorld(true);
      this.ready = true;
      this.invalidate();
    } catch (error) {
      if (this.usable) this.options.onError(error);
    } finally {
      this.ktx2.dispose();
    }
  }

  private async loadEnvironment(url: string): Promise<Texture> {
    const extension = new URL(url).pathname.toLowerCase();
    // Own the network request so destroy/timeout aborts environment downloads too.
    const response = await fetch(url, { signal: this.fetchAbort.signal, credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Storefront environment returned ${response.status}`);
    const blob = await response.blob();
    if (!this.usable) throw new DOMException('Storefront cancelled', 'AbortError');
    const localUrl = URL.createObjectURL(blob);
    try {
      if (extension.endsWith('.hdr')) {
        const { HDRLoader } = await import('three/examples/jsm/loaders/HDRLoader.js');
        if (!this.usable) throw new DOMException('Storefront cancelled', 'AbortError');
        return await new HDRLoader().loadAsync(localUrl);
      }
      if (extension.endsWith('.exr')) {
        const { EXRLoader } = await import('three/examples/jsm/loaders/EXRLoader.js');
        if (!this.usable) throw new DOMException('Storefront cancelled', 'AbortError');
        return await new EXRLoader().loadAsync(localUrl);
      }
      const texture = await new TextureLoader().loadAsync(localUrl);
      texture.colorSpace = SRGBColorSpace;
      return texture;
    } finally {
      URL.revokeObjectURL(localUrl);
    }
  }

  private installListeners(): void {
    const { surface, canvas, signal } = this.options;
    const listen = (target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions) => {
      target.addEventListener(type, handler, options);
      this.removers.push(() => target.removeEventListener(type, handler, options));
    };
    listen(signal, 'abort', (() => this.dispose()) as EventListener, { once: true });
    listen(canvas, 'webglcontextlost', ((event: Event) => {
      event.preventDefault();
      if (this.usable) this.options.onError(new Error('WebGL context lost'));
    }) as EventListener);
    listen(this.document, 'visibilitychange', (() => {
      if (this.document.hidden) {
        this.cancelApproach();
        if (this.frame !== null) this.options.clock.cancelFrame(this.frame);
        this.frame = null;
      } else {
        this.invalidate();
      }
    }) as EventListener);
    listen(surface, 'pointerdown', ((event: PointerEvent) => {
      if (event.button !== 0 || !this.ready) return;
      if ((event.target as Element).closest('button')) return;
      this.gesture.down(event.pointerId, event.clientX, event.clientY);
    }) as EventListener, { passive: true });
    listen(this.view, 'pointermove', ((event: PointerEvent) => {
      const delta = this.gesture.move(event.pointerId, event.clientX, event.clientY);
      if (this.gesture.active) {
        if (delta && this.overview.portrait && !this.travel) {
          const overview = this.overview;
          this.pan = clamp(overview.pan - delta * overview.unitsPerPixel, overview.minPan, overview.maxPan);
          this.applyPose(this.overview.pose);
          this.invalidate();
          if (!surface.hasPointerCapture(event.pointerId)) {
            try { surface.setPointerCapture(event.pointerId); } catch { /* Pointer may already be cancelled. */ }
          }
        }
        return;
      }
      if (event.pointerType !== 'mouse' || !surface.contains(event.target as Node) || this.travel) return;
      const id = this.pick(event.clientX, event.clientY);
      if (id !== this.hovered) {
        this.hovered = id;
        canvas.style.cursor = id ? 'pointer' : this.overview.portrait ? 'grab' : 'default';
        this.options.onHover(id);
      }
    }) as EventListener, { passive: true });
    listen(this.view, 'pointerup', ((event: PointerEvent) => {
      this.gesture.move(event.pointerId, event.clientX, event.clientY);
      this.gesture.up(event.pointerId);
    }) as EventListener, { passive: true });
    listen(this.view, 'pointercancel', ((event: PointerEvent) => this.gesture.cancel(event.pointerId)) as EventListener, { passive: true });
    listen(surface, 'lostpointercapture', ((event: PointerEvent) => {
      this.gesture.lostCapture(event.target === surface, surface.hasPointerCapture(event.pointerId));
    }) as EventListener);
    listen(surface, 'dragstart', ((event: Event) => event.preventDefault()) as EventListener);
    listen(surface, 'click', ((event: MouseEvent) => {
      if (this.gesture.suppressClick(event.detail)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if ((event.target as Element).closest('a, button')) return;
      if (!plainActivation(event) || this.travel) return;
      const id = this.pick(event.clientX, event.clientY);
      if (id) this.options.onActivate(id, event);
    }) as EventListener, { capture: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(surface);
    } else {
      listen(this.view, 'resize', (() => this.resize()) as EventListener, { passive: true });
    }
  }

  private resize(): void {
    if (!this.usable) return;
    const rect = this.options.surface.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const wasPortrait = this.width < this.height;
    if (this.width === width && this.height === height && this.firstFrame) return;
    this.width = width;
    this.height = height;
    this.mobile = this.view.matchMedia('(pointer: coarse)').matches || width < 768;
    const dpr = Math.min(this.view.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    const active = this.document.activeElement;
    const activeId = active?.getAttribute('data-shop');
    const focusedShop = active && active.matches(':focus-visible') && this.options.surface.contains(active)
      ? this.options.manifest.storefronts.find(shop => shop.id === activeId)?.id ?? null
      : null;
    this.pan = panAfterResize(this.options.manifest, wasPortrait, width < height, this.pan, focusedShop);
    this.cancelApproach();
    const overview = this.overview;
    this.pan = overview.pan;
    this.applyPose(overview.pose);
    this.invalidate();
  }

  private applyPose(pose: CameraPose): void {
    this.pose = pose;
    this.camera.position.set(...pose.position);
    this.camera.lookAt(new Vector3(...pose.target));
    this.camera.aspect = this.width / this.height;
    this.camera.fov = pose.fov;
    // Framing and clipping use the exported composition, not distant/hidden background meshes.
    const distance = this.camera.position.distanceTo(new Vector3(...pose.target));
    const bounds = this.options.manifest.bounds;
    const span = Math.hypot(...bounds.max.map((value, index) => value - bounds.min[index]));
    this.camera.near = Math.max(.01, distance / 1000);
    this.camera.far = Math.max(1000, distance + span * 20);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }

  private invalidate(): void {
    if (this.usable && this.ready && !this.document.hidden && this.frame === null) {
      this.frame = this.options.clock.requestFrame(time => this.render(time));
    }
  }

  private render(time: number): void {
    this.frame = null;
    if (!this.usable || !this.ready || this.document.hidden) return;
    let completed: Travel | null = null;
    if (this.travel) {
      const progress = (time - this.travel.started) / this.travel.duration;
      this.applyPose(interpolatePose(this.travel.from, this.travel.to, progress));
      if (progress >= 1) {
        completed = this.travel;
        this.travel = null;
      }
    }
    try {
      this.renderer.render(this.scene, this.camera);
      this.frames++;
      this.options.onProjection(this.projectShops());
      this.options.onMetrics({
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        frames: this.frames,
        camera: this.camera.position.toArray() as [number, number, number],
        fov: this.camera.fov,
        pan: this.pan ?? 0
      });
      if (!this.firstFrame) {
        this.firstFrame = true;
        this.options.onFirstFrame();
      }
      completed?.resolve(true);
      if (this.travel) this.invalidate();
    } catch (error) {
      completed?.resolve(false);
      this.cancelApproach();
      if (this.usable) this.options.onError(error);
    }
  }

  private projectShops(): ShopProjection[] {
    return this.options.manifest.storefronts.map(shop => {
      const points = boundsCorners(shop.hitBox).map(corner => new Vector3(...corner).project(this.camera));
      const xs = points.map(point => (point.x + 1) * this.width / 2);
      const ys = points.map(point => (1 - point.y) * this.height / 2);
      const left = Math.min(...xs);
      const top = Math.min(...ys);
      const right = Math.max(...xs);
      const bottom = Math.max(...ys);
      return {
        id: shop.id, left, top, width: right - left, height: bottom - top,
        visible: points.some(point => point.z > -1 && point.z < 1) && right > 0 && left < this.width && bottom > 0 && top < this.height
      };
    });
  }

  pick(clientX: number, clientY: number): StorefrontId | null {
    if (!this.ready || !this.usable) return null;
    const rect = this.options.surface.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const point = pointerNdc(clientX, clientY, rect);
    this.raycaster.setFromCamera(new Vector2(point.x, point.y), this.camera);
    let closest: StorefrontId | null = null;
    let distance = Infinity;
    // Box3 ray proxies are never rendered and add no scene geometry or draw calls.
    for (const proxy of this.boxes) {
      const hit = this.raycaster.ray.intersectBox(proxy.box, this.hitPoint);
      if (!hit) continue;
      const depth = hit.distanceTo(this.raycaster.ray.origin);
      if (depth < distance) { closest = proxy.id; distance = depth; }
    }
    return closest;
  }

  approach(id: StorefrontId, duration: number): Promise<boolean> {
    if (!this.usable || !this.ready) return Promise.resolve(false);
    const shop = this.options.manifest.storefronts.find(candidate => candidate.id === id);
    if (!shop) return Promise.resolve(false);
    this.cancelApproach();
    this.gesture.cancel();
    const to = fitPose(shop.focus, shop.hitBox, this.width / this.height);
    if (duration <= 0) {
      this.applyPose(to);
      this.invalidate();
      return Promise.resolve(true);
    }
    return new Promise(resolve => {
      this.travel = { from: this.pose, to, started: this.options.clock.now(), duration, resolve };
      this.invalidate();
    });
  }

  cancelApproach(): void {
    const travel = this.travel;
    this.travel = null;
    if (travel) {
      this.applyPose(this.overview.pose);
      travel.resolve(false);
      this.invalidate();
    }
  }

  resetOverview(): void {
    if (!this.usable) return;
    this.cancelApproach();
    this.pan = undefined;
    const overview = this.overview;
    this.pan = overview.pan;
    this.applyPose(overview.pose);
    this.gesture.cancel();
    this.invalidate();
  }

  focusShop(id: StorefrontId): void {
    if (!this.usable || this.travel || !this.overview.portrait) return;
    this.pan = panForShop(this.options.manifest, id);
    const overview = this.overview;
    this.pan = overview.pan;
    this.applyPose(overview.pose);
    // Position the currently focused anchor synchronously; avoid native off-screen focus scrolling.
    this.options.onProjection(this.projectShops());
    this.invalidate();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.fetchAbort.abort();
    if (this.frame !== null) this.options.clock.cancelFrame(this.frame);
    this.frame = null;
    this.travel?.resolve(false);
    this.travel = null;
    this.resizeObserver?.disconnect();
    for (const remove of this.removers) remove();
    this.removers.length = 0;
    // Do not terminate KTX workers mid-parse: Three's WorkerPool would strand its
    // promises. load() disposes the decoder in finally, after disposing any late GLTF.
    disposeObjectTree([this.scene, ...this.loadedScenes]);
    this.loadedScenes = [];
    this.environment?.dispose();
    this.environment = null;
    this.scene.environment = null;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

export function createStorefrontRuntime(options: StorefrontRuntimeOptions): StorefrontRuntime {
  if (options.signal.aborted) throw new DOMException('Storefront cancelled', 'AbortError');
  return new ThreeStorefrontRuntime(options);
}
