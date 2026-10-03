import { DOCUMENT, NgFor, NgIf, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, InjectionToken, NgZone,
  PLATFORM_ID, ViewChild, afterNextRender, inject, signal
} from '@angular/core';
import { Router } from '@angular/router';
import scene from './storefront.scene.json';
import { plainActivation } from './storefront.math';
import {
  STOREFRONT_CLOCK, STOREFRONT_EXTERNAL_NAVIGATE, STOREFRONT_PREFETCH, STOREFRONT_RUNTIME_FACTORY
} from './storefront.providers';
import {
  APPROACH_DURATION_MS, LOAD_TIMEOUT_MS, STOREFRONT_DESTINATIONS, STOREFRONT_IDS,
  RuntimeMetrics, ShopProjection, StorefrontId, StorefrontManifest, StorefrontRuntime, StorefrontState
} from './storefront.types';

export const STOREFRONT_MANIFEST = new InjectionToken<StorefrontManifest>('Storefront manifest', {
  providedIn: 'root', factory: () => scene as unknown as StorefrontManifest
});

@Component({
  selector: 'app-storefront',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './storefront.component.html',
  styleUrl: './storefront.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-state]': 'state()',
    '[attr.data-selected]': 'selected() ?? ""',
    '[style.background]': 'manifest.background'
  }
})
export class StorefrontComponent {
  @ViewChild('surface', { static: true }) private surface!: ElementRef<HTMLElement>;
  @ViewChild('canvasMount', { static: true }) private canvasMount!: ElementRef<HTMLElement>;

  readonly manifest = inject(STOREFRONT_MANIFEST);
  readonly state = signal<StorefrontState>('loading');
  readonly selected = signal<StorefrontId | null>(null);
  readonly firstFrame = signal(false);
  readonly errorMessage = signal('');
  readonly shops = STOREFRONT_IDS.map(id => ({ id, ...STOREFRONT_DESTINATIONS[id] }));

  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly runtimeFactory = inject(STOREFRONT_RUNTIME_FACTORY);
  private readonly clock = inject(STOREFRONT_CLOCK);
  private readonly prefetch = inject(STOREFRONT_PREFETCH);
  private readonly externalNavigate = inject(STOREFRONT_EXTERNAL_NAVIGATE);
  private readonly prefetched = new Set<StorefrontId>();
  private runtime: StorefrontRuntime | null = null;
  private abort: AbortController | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private deadline: number | null = null;
  private deadlineRemaining = LOAD_TIMEOUT_MS;
  private deadlineStarted = 0;
  private attempt = 0;
  private selection = 0;
  private destroyed = false;
  private removeBrowserListeners: (() => void) | null = null;

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId) || this.destroyed) return;
      this.zone.runOutsideAngular(() => {
        const view = this.document.defaultView;
        const escape = (event: KeyboardEvent) => {
          if (event.key === 'Escape' && this.state() === 'approaching') {
            event.preventDefault();
            this.zone.run(() => this.cancelSelection());
          }
        };
        const pageShow = (event: PageTransitionEvent) => {
          if (!event.persisted || this.destroyed) return;
          this.zone.run(() => {
            this.selection++;
            this.selected.set(null);
            if (this.runtime && this.firstFrame()) {
              this.zone.runOutsideAngular(() => this.runtime?.resetOverview());
              this.state.set('ready');
            } else {
              this.zone.runOutsideAngular(() => this.start());
            }
          });
        };
        const visibility = () => {
          if (this.document.hidden) this.pauseDeadline();
          else this.resumeDeadline();
        };
        view?.addEventListener('keydown', escape);
        view?.addEventListener('pageshow', pageShow);
        this.document.addEventListener('visibilitychange', visibility);
        this.removeBrowserListeners = () => {
          view?.removeEventListener('keydown', escape);
          view?.removeEventListener('pageshow', pageShow);
          this.document.removeEventListener('visibilitychange', visibility);
        };
        this.start();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.attempt++;
      this.selection++;
      this.removeBrowserListeners?.();
      this.releaseRuntime();
    });
  }

  get statusText(): string {
    const name = this.selected() ? STOREFRONT_DESTINATIONS[this.selected()!].name : '';
    switch (this.state()) {
      case 'loading': return 'Loading the street. The destination links are available now.';
      case 'approaching': return `Moving to ${name}. Press Escape to cancel.`;
      case 'navigating': return `Opening ${name}.`;
      case 'error': return this.errorMessage();
      case 'ready': return 'Choose a shop. On portrait screens, swipe horizontally to explore the street.';
    }
  }

  retry(): void {
    if (!this.destroyed && isPlatformBrowser(this.platformId)) this.zone.runOutsideAngular(() => this.start());
  }

  prefetchShop(id: StorefrontId): void {
    if (!isPlatformBrowser(this.platformId) || this.prefetched.has(id)) return;
    this.prefetched.add(id);
    // An unsuccessful speculative import must never prevent real navigation.
    void this.prefetch(id).catch(() => this.prefetched.delete(id));
  }

  focusShop(id: StorefrontId, event?: FocusEvent): void {
    this.prefetchShop(id);
    // A pointer focus must not move its shop away between pointerdown and click.
    if (event && !(event.target as HTMLElement).matches(':focus-visible')) return;
    if (this.state() === 'ready') this.zone.runOutsideAngular(() => this.runtime?.focusShop(id));
  }

  linkClick(id: StorefrontId, event: MouseEvent): void {
    // Real anchors preserve open-in-new-tab/window, context menu and fallback navigation.
    if (!plainActivation(event) || !this.runtime || !this.firstFrame() || this.state() === 'error') return;
    event.preventDefault();
    if (event.detail > 0 && this.runtime.pick(event.clientX, event.clientY) !== id) return;
    this.activateShop(id);
  }

  activateShop(id: StorefrontId): void {
    if (this.destroyed || this.state() !== 'ready' || !this.runtime) return;
    const operation = ++this.selection;
    this.selected.set(id);
    this.state.set('approaching');
    this.prefetchShop(id);
    const reducedMotion = this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
    const runtime = this.runtime;
    this.zone.runOutsideAngular(() => {
      void runtime.approach(id, reducedMotion ? 0 : APPROACH_DURATION_MS).then(completed => {
        if (this.destroyed || operation !== this.selection || runtime !== this.runtime) return;
        this.zone.run(() => {
          if (!completed) {
            this.selected.set(null);
            this.state.set('ready');
            return;
          }
          this.state.set('navigating');
          const destination = STOREFRONT_DESTINATIONS[id];
          if (destination.external) {
            try { this.externalNavigate(destination.href); }
            catch { this.cancelSelection(); }
            return;
          }
          // This completion intentionally survives component destruction caused by successful routing.
          const document = this.document;
          const router = this.router;
          void router.navigateByUrl(destination.href).then(success => {
            if (success) {
              // Router's promise resolves after outlet activation. A microtask lets its bindings settle.
              queueMicrotask(() => {
                if (router.url.split(/[?#]/)[0] !== destination.href) return;
                const heading = document.querySelector<HTMLElement>('main h1, h1, main h2, [role="main"] h2');
                if (heading) {
                  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
                  heading.focus({ preventScroll: true });
                }
              });
            } else if (!this.destroyed && operation === this.selection) {
              this.cancelSelection();
            }
          }).catch(() => {
            if (!this.destroyed && operation === this.selection) this.cancelSelection();
          });
        });
      }).catch(() => {
        if (!this.destroyed && operation === this.selection) this.zone.run(() => this.cancelSelection());
      });
    });
  }

  private cancelSelection(): void {
    this.selection++;
    this.zone.runOutsideAngular(() => {
      this.runtime?.cancelApproach();
      this.runtime?.resetOverview();
    });
    this.selected.set(null);
    if (this.firstFrame()) this.state.set('ready');
  }

  private start(): void {
    if (this.destroyed) return;
    const attempt = ++this.attempt;
    this.selection++;
    this.releaseRuntime();
    this.zone.run(() => {
      this.state.set('loading');
      this.selected.set(null);
      this.firstFrame.set(false);
      this.errorMessage.set('');
    });
    const abort = new AbortController();
    this.abort = abort;
    const canvas = this.document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    this.canvasMount.nativeElement.appendChild(canvas);
    this.canvas = canvas;
    const current = () => !this.destroyed && attempt === this.attempt && !abort.signal.aborted;
    this.deadlineRemaining = LOAD_TIMEOUT_MS;
    this.resumeDeadline();
    const options = {
      canvas,
      surface: this.surface.nativeElement,
      manifest: this.manifest,
      signal: abort.signal,
      clock: this.clock,
      onFirstFrame: () => {
        if (!current()) return;
        this.clearDeadline();
        this.zone.run(() => {
          this.firstFrame.set(true);
          this.state.set('ready');
        });
        const active = this.document.activeElement;
        const focusedId = active?.getAttribute('data-shop') as StorefrontId | null;
        if (focusedId && STOREFRONT_IDS.includes(focusedId) && this.surface.nativeElement.contains(active) && active?.matches(':focus-visible')) {
          this.runtime?.focusShop(focusedId);
        }
      },
      onError: (_error: unknown) => {
        if (current()) this.fail('The 3D street is unavailable. Please use a destination link or try again.');
      },
      onProjection: (projections: readonly ShopProjection[]) => {
        if (current()) this.projectLinks(projections);
      },
      onHover: (id: StorefrontId | null) => { if (current() && id) this.prefetchShop(id); },
      onActivate: (id: StorefrontId, event: MouseEvent) => {
        if (current() && plainActivation(event)) this.zone.run(() => this.activateShop(id));
      },
      onMetrics: (metrics: RuntimeMetrics) => { if (current()) this.publishMetrics(metrics); }
    };
    void Promise.resolve().then(() => {
      if (!current()) return null;
      return this.runtimeFactory(options);
    }).then(runtime => {
      if (!runtime) return;
      if (!current()) runtime.dispose();
      else this.runtime = runtime;
    }).catch(error => options.onError(error));
  }

  private fail(message: string): void {
    this.attempt++;
    this.selection++;
    this.releaseRuntime();
    this.zone.run(() => {
      this.firstFrame.set(false);
      this.selected.set(null);
      this.errorMessage.set(message);
      this.state.set('error');
    });
  }

  private resumeDeadline(): void {
    if (this.destroyed || this.document.hidden || this.state() !== 'loading' || !this.abort || this.deadline !== null) return;
    const attempt = this.attempt;
    this.deadlineStarted = this.clock.now();
    this.deadline = this.clock.setTimeout(() => {
      this.deadline = null;
      if (!this.destroyed && attempt === this.attempt && this.state() === 'loading') {
        this.fail('The 3D street took too long to load. Please use a destination link or try again.');
      }
    }, this.deadlineRemaining);
  }

  private pauseDeadline(): void {
    if (this.deadline === null) return;
    // Rendering deliberately pauses in background tabs, so the loading budget
    // must count foreground time rather than fail a fully loaded hidden scene.
    this.deadlineRemaining = Math.max(0, this.deadlineRemaining - (this.clock.now() - this.deadlineStarted));
    this.clearDeadline();
  }

  private clearDeadline(): void {
    if (this.deadline !== null) this.clock.clearTimeout(this.deadline);
    this.deadline = null;
  }

  private releaseRuntime(): void {
    this.clearDeadline();
    this.abort?.abort();
    this.abort = null;
    this.runtime?.dispose();
    this.runtime = null;
    this.canvas?.remove();
    this.canvas = null;
  }

  private projectLinks(projections: readonly ShopProjection[]): void {
    for (const projection of projections) {
      const link = this.surface.nativeElement.querySelector<HTMLElement>(`[data-shop="${projection.id}"]`);
      if (!link) continue;
      link.style.setProperty('--shop-left', `${projection.left}px`);
      link.style.setProperty('--shop-top', `${projection.top}px`);
      link.style.setProperty('--shop-width', `${projection.width}px`);
      link.style.setProperty('--shop-height', `${projection.height}px`);
      link.dataset['visible'] = String(projection.visible);
    }
  }

  private publishMetrics(metrics: RuntimeMetrics): void {
    const data = this.host.nativeElement.dataset;
    data['drawCalls'] = String(metrics.calls);
    data['triangles'] = String(metrics.triangles);
    data['renderedFrames'] = String(metrics.frames);
    data['camera'] = metrics.camera.map(value => value.toFixed(3)).join(',');
    data['fov'] = metrics.fov.toFixed(3);
    data['pan'] = metrics.pan.toFixed(3);
  }
}
