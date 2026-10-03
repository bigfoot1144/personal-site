import type {
  StorefrontClock, StorefrontId, StorefrontManifest, StorefrontRuntime
} from './storefront.types';

/** Small deterministic scene description; tests never fetch the production assets. */
export const TEST_MANIFEST: StorefrontManifest = {
  version: 1,
  source: 'test-street.blend',
  background: '#03182b',
  assets: {
    desktop: { url: '/test/street.glb', bytes: 100 },
    mobile: { url: '/test/street-mobile.glb', bytes: 50 },
    poster: { url: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', width: 1600, height: 1200 }
  },
  bounds: { min: [-9, 0, -1], max: [9, 10, 1] },
  overview: { position: [0, 5, 25], target: [0, 5, 0], fov: 40 },
  storefronts: (['learning', 'blog', 'about', 'projects'] as const).map((id, index) => {
    const x = -6 + index * 4;
    return {
      id,
      hitBox: { min: [x - 1.7, .2, .5], max: [x + 1.7, 4.5, 1.5] },
      focus: { position: [x, 2.5, 9], target: [x, 2.5, 1], fov: 35 },
      sign: { position: [x, 4, 1.5], width: 3.4, height: .8 }
    };
  })
};

export class TestClock implements StorefrontClock {
  private time = 0;
  private nextId = 1;
  private readonly pending = new Map<number, { at: number; run: () => void }>();
  now(): number { return this.time; }
  get pendingCount(): number { return this.pending.size; }
  requestFrame(callback: FrameRequestCallback): number { return this.setTimeout(() => callback(this.time), 16); }
  cancelFrame(id: number): void { this.clearTimeout(id); }
  setTimeout(callback: () => void, milliseconds: number): number {
    const id = this.nextId++;
    this.pending.set(id, { at: this.time + milliseconds, run: callback });
    return id;
  }
  clearTimeout(id: number): void { this.pending.delete(id); }
  advance(milliseconds: number): void {
    const end = this.time + milliseconds;
    for (;;) {
      const next = [...this.pending].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.time = next[1].at;
      this.pending.delete(next[0]);
      next[1].run();
    }
    this.time = end;
  }
}

export class MockStorefrontRuntime implements StorefrontRuntime {
  readonly approaches: Array<{ id: StorefrontId; duration: number }> = [];
  readonly focused: StorefrontId[] = [];
  disposed = false;
  resets = 0;
  picked: StorefrontId | null = 'learning';
  private finish: ((completed: boolean) => void) | null = null;
  private timer: number | null = null;
  constructor(private readonly clock: TestClock) {}
  approach(id: StorefrontId, duration: number): Promise<boolean> {
    this.approaches.push({ id, duration });
    return new Promise(resolve => {
      this.finish = resolve;
      if (duration === 0) resolve(true);
      else this.timer = this.clock.setTimeout(() => { this.finish = null; resolve(true); }, duration);
    });
  }
  cancelApproach(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.finish?.(false);
    this.finish = null;
  }
  resetOverview(): void { this.cancelApproach(); this.resets++; }
  focusShop(id: StorefrontId): void { this.focused.push(id); }
  pick(): StorefrontId | null { return this.picked; }
  dispose(): void { this.disposed = true; this.cancelApproach(); }
}
