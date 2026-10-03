import { Bounds, CameraPose, StorefrontId, StorefrontManifest, Vec3 } from './storefront.types';

export const REFERENCE_ASPECT = 4 / 3;
export const DRAG_THRESHOLD_PX = 8;
const RADIANS = Math.PI / 180;

export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (v: Vec3, factor: number): Vec3 => [v[0] * factor, v[1] * factor, v[2] * factor];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (v: Vec3): number => Math.hypot(...v);
const normalize = (v: Vec3): Vec3 => scale(v, 1 / (length(v) || 1));

export function cameraBasis(pose: CameraPose): { forward: Vec3; right: Vec3; up: Vec3 } {
  const forward = normalize(subtract(pose.target, pose.position));
  const right = normalize(cross(forward, Math.abs(forward[1]) > .999 ? [0, 0, 1] : [0, 1, 0]));
  return { forward, right, up: normalize(cross(right, forward)) };
}

export function boundsCorners(bounds: Bounds): Vec3[] {
  return [bounds.min[0], bounds.max[0]].flatMap(x =>
    [bounds.min[1], bounds.max[1]].flatMap(y =>
      [bounds.min[2], bounds.max[2]].map(z => [x, y, z] as Vec3)));
}

export function boundsCenter(bounds: Bounds): Vec3 {
  return scale(add(bounds.min, bounds.max), .5);
}

/** Fit ONLY the curated composition bounds, never a raw GLB bounding box. */
export function fitPose(pose: CameraPose, bounds: Bounds, aspect: number): CameraPose {
  const { forward, right, up } = cameraBasis(pose);
  const tangent = Math.tan(pose.fov * RADIANS / 2);
  let distance = length(subtract(pose.position, pose.target));
  for (const corner of boundsCorners(bounds)) {
    const delta = subtract(corner, pose.target);
    const depth = dot(delta, forward);
    distance = Math.max(distance,
      Math.abs(dot(delta, right)) / (tangent * Math.max(.01, aspect)) - depth,
      Math.abs(dot(delta, up)) / tangent - depth);
  }
  return { ...pose, position: subtract(pose.target, scale(forward, distance)) };
}

export interface OverviewFrame {
  pose: CameraPose;
  portrait: boolean;
  pan: number;
  minPan: number;
  maxPan: number;
  unitsPerPixel: number;
}

export function overviewFrame(manifest: StorefrontManifest, width: number, height: number, requestedPan?: number): OverviewFrame {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const portrait = aspect < 1;
  // The source camera is authoritative. Fitting an AABB's empty front/top corners
  // would zoom away from the reference composition, even at its native 4:3 ratio.
  const pose: CameraPose = {
    ...manifest.overview,
    fov: !portrait && aspect < REFERENCE_ASPECT
      ? 2 * Math.atan(Math.tan(manifest.overview.fov * RADIANS / 2) * REFERENCE_ASPECT / aspect) / RADIANS
      : manifest.overview.fov
  };
  const { forward, right } = cameraBasis(pose);
  const distance = length(subtract(pose.position, pose.target));
  const tangent = Math.tan(pose.fov * RADIANS / 2);
  const corners = boundsCorners(manifest.bounds).map(corner => {
    const delta = subtract(corner, pose.target);
    return { x: dot(delta, right), halfWidth: (distance + dot(delta, forward)) * tangent * aspect };
  });
  // Keep the viewport inside the exported row at its near/far depth, including angled cameras.
  const leftEdge = Math.min(...corners.map(corner => corner.x + corner.halfWidth));
  const rightEdge = Math.max(...corners.map(corner => corner.x - corner.halfWidth));
  const midpoint = (leftEdge + rightEdge) / 2;
  const minPan = portrait ? Math.min(leftEdge, midpoint) : 0;
  const maxPan = portrait ? Math.max(rightEdge, midpoint) : 0;
  const learning = manifest.storefronts.find(shop => shop.id === 'learning');
  const initialPan = learning ? dot(subtract(boundsCenter(learning.hitBox), pose.target), right) : minPan;
  const pan = portrait ? clamp(requestedPan ?? initialPan, minPan, maxPan) : 0;
  const offset = scale(right, pan);
  return {
    pose: { ...pose, position: add(pose.position, offset), target: add(pose.target, offset) },
    portrait, pan, minPan, maxPan,
    unitsPerPixel: 2 * distance * tangent / Math.max(1, height)
  };
}

export function panForShop(manifest: StorefrontManifest, id: string): number {
  const shop = manifest.storefronts.find(candidate => candidate.id === id);
  return shop ? dot(subtract(boundsCenter(shop.hitBox), manifest.overview.target), cameraBasis(manifest.overview).right) : 0;
}

export function panAfterResize(
  manifest: StorefrontManifest, wasPortrait: boolean, portrait: boolean,
  currentPan: number | undefined, focusedShop: StorefrontId | null
): number | undefined {
  if (portrait && focusedShop) return panForShop(manifest, focusedShop);
  return wasPortrait === portrait ? currentPan : undefined;
}

export function interpolatePose(from: CameraPose, to: CameraPose, progress: number): CameraPose {
  const t = clamp(progress, 0, 1);
  const eased = t * t * (3 - 2 * t);
  const mix = (a: Vec3, b: Vec3): Vec3 => add(a, scale(subtract(b, a), eased));
  return { position: mix(from.position, to.position), target: mix(from.target, to.target), fov: from.fov + (to.fov - from.fov) * eased };
}

export function pointerNdc(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
    y: -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
  };
}

export function plainActivation(event: Pick<MouseEvent, 'button' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): boolean {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

/** Gesture state is independent of the GPU and retains the maximum excursion. */
export class PointerGesture {
  private readonly pointers = new Set<number>();
  private originX = 0;
  private originY = 0;
  private lastX = 0;
  private primaryId: number | null = null;
  private blocked = false;
  dragged = false;

  get active(): boolean { return this.pointers.size > 0; }

  down(id: number, x: number, y: number): void {
    if (this.pointers.size === 0) {
      this.primaryId = id;
      this.originX = this.lastX = x;
      this.originY = y;
      this.blocked = false;
      this.dragged = false;
    } else {
      this.blocked = true;
    }
    this.pointers.add(id);
  }

  move(id: number, x: number, y: number): number {
    if (id !== this.primaryId || !this.pointers.has(id)) return 0;
    const delta = x - this.lastX;
    this.lastX = x;
    if (Math.hypot(x - this.originX, y - this.originY) > DRAG_THRESHOLD_PX) this.dragged = true;
    return this.blocked || this.pointers.size !== 1 || !this.dragged ? 0 : delta;
  }

  up(id: number): void { this.pointers.delete(id); }

  cancel(id?: number): void {
    this.blocked = true;
    if (id === undefined) this.pointers.clear();
    else this.pointers.delete(id);
  }

  lostCapture(fromSurface: boolean, surfaceStillCaptures: boolean): void {
    // Touch starts with implicit capture on the anchor. Transferring it to the
    // surface emits a bubbled child loss; that is not cancellation of the swipe.
    if (this.active && fromSurface && !surfaceStillCaptures) this.cancel();
  }

  suppressClick(detail: number): boolean {
    return detail !== 0 && (this.dragged || this.blocked);
  }
}
