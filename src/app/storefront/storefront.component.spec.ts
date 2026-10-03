import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Router } from '@angular/router';
import { STOREFRONT_MANIFEST, StorefrontComponent } from './storefront.component';
import {
  STOREFRONT_CLOCK, STOREFRONT_EXTERNAL_NAVIGATE, STOREFRONT_PREFETCH, STOREFRONT_RUNTIME_FACTORY
} from './storefront.providers';
import { MockStorefrontRuntime, TEST_MANIFEST, TestClock } from './storefront.testing';
import { LOAD_TIMEOUT_MS, StorefrontRuntime, StorefrontRuntimeOptions } from './storefront.types';

describe('StorefrontComponent without GPU or production assets', () => {
  let fixture: ComponentFixture<StorefrontComponent>;
  let component: StorefrontComponent;
  let clock: TestClock;
  let runtime: MockStorefrontRuntime;
  let options: StorefrontRuntimeOptions;
  let factory: jasmine.Spy;
  let prefetch: jasmine.Spy;
  let external: jasmine.Spy;
  let router: { url: string; navigateByUrl: jasmine.Spy };

  beforeEach(async () => {
    clock = new TestClock();
    runtime = new MockStorefrontRuntime(clock);
    factory = jasmine.createSpy('runtimeFactory').and.callFake((value: StorefrontRuntimeOptions) => {
      options = value;
      return Promise.resolve(runtime);
    });
    prefetch = jasmine.createSpy('intentPrefetch').and.returnValue(Promise.resolve());
    external = jasmine.createSpy('sameTabNavigate');
    router = { url: '/', navigateByUrl: jasmine.createSpy('navigateByUrl').and.callFake((url: string) => {
      router.url = url;
      return Promise.resolve(true);
    }) };
    await TestBed.configureTestingModule({
      imports: [StorefrontComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: STOREFRONT_MANIFEST, useValue: TEST_MANIFEST },
        { provide: STOREFRONT_CLOCK, useValue: clock },
        { provide: STOREFRONT_RUNTIME_FACTORY, useValue: factory },
        { provide: STOREFRONT_PREFETCH, useValue: prefetch },
        { provide: STOREFRONT_EXTERNAL_NAVIGATE, useValue: external },
        { provide: Router, useValue: router }
      ]
    }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  function initialize(ready = false): void {
    fixture = TestBed.createComponent(StorefrontComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushMicrotasks();
    if (ready) {
      options.onFirstFrame();
      fixture.detectChanges();
    }
  }

  it('renders SSR poster and four real links without invoking the runtime or importing content', fakeAsync(() => {
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    initialize();
    expect(factory).not.toHaveBeenCalled();
    expect(prefetch).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
    const links = [...fixture.nativeElement.querySelectorAll('a')] as HTMLAnchorElement[];
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/knowledge', '/blog', '/about', 'https://github.com/bigfoot1144']);
    expect(links.every(link => !link.hasAttribute('target') && !!link.getAttribute('aria-label'))).toBeTrue();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(TEST_MANIFEST.assets.poster.url);
    expect(clock.pendingCount).toBe(0);
  }));

  it('only fades the poster after a real first-frame callback and does no idle content prefetch', fakeAsync(() => {
    initialize();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(component.state()).toBe('loading');
    expect(fixture.nativeElement.querySelector('.poster-revealed')).toBeNull();
    options.onFirstFrame();
    fixture.detectChanges();
    expect(component.state()).toBe('ready');
    expect(fixture.nativeElement.querySelector('.poster-revealed')).not.toBeNull();
    expect(clock.pendingCount).toBe(0);
    clock.advance(60_000);
    expect(prefetch).not.toHaveBeenCalled();
  }));

  it('waits 900ms and prevents duplicate navigation while approaching or navigating', fakeAsync(() => {
    initialize(true);
    component.activateShop('blog');
    component.activateShop('learning');
    expect(component.state()).toBe('approaching');
    expect(runtime.approaches).toEqual([{ id: 'blog', duration: 900 }]);
    clock.advance(899);
    flushMicrotasks();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    clock.advance(1);
    flushMicrotasks();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/blog');
    expect(component.state()).toBe('navigating');
    component.activateShop('about');
    expect(runtime.approaches.length).toBe(1);
  }));

  it('uses the exact destination map for keyboard and raycast canvas selection', fakeAsync(() => {
    initialize(true);
    const keyboardClick = new MouseEvent('click', { button: 0, detail: 0, cancelable: true });
    component.linkClick('about', keyboardClick);
    expect(keyboardClick.defaultPrevented).toBeTrue();
    clock.advance(900);
    flushMicrotasks();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/about');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    options.onActivate('learning', new MouseEvent('click', { button: 0, detail: 1 }));
    clock.advance(900);
    flushMicrotasks();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/knowledge');
  }));

  it('keeps native modifier clicks and fallback links unintercepted', fakeAsync(() => {
    initialize();
    const fallback = new MouseEvent('click', { button: 0, cancelable: true });
    component.linkClick('learning', fallback);
    expect(fallback.defaultPrevented).toBeFalse();
    options.onFirstFrame();
    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
      const event = new MouseEvent('click', { button: 0, cancelable: true, [modifier]: true });
      component.linkClick('learning', event);
      expect(event.defaultPrevented).toBeFalse();
    }
    expect(runtime.approaches.length).toBe(0);
  }));

  it('requires the matching shop ray proxy for pointer clicks on projected links', fakeAsync(() => {
    initialize(true);
    runtime.picked = 'blog';
    component.linkClick('learning', new MouseEvent('click', { button: 0, detail: 1, cancelable: true }));
    expect(runtime.approaches.length).toBe(0);
    component.linkClick('blog', new MouseEvent('click', { button: 0, detail: 1, cancelable: true }));
    expect(runtime.approaches[0].id).toBe('blog');
  }));

  it('cancels travel on Escape and never performs its late navigation', fakeAsync(() => {
    initialize(true);
    component.activateShop('blog');
    clock.advance(200);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    clock.advance(2000);
    flushMicrotasks();
    expect(component.state()).toBe('ready');
    expect(component.selected()).toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(runtime.resets).toBeGreaterThan(0);
  }));

  it('skips camera travel for reduced motion and opens GitHub in the same tab', fakeAsync(() => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    initialize(true);
    component.activateShop('projects');
    flushMicrotasks();
    expect(runtime.approaches).toEqual([{ id: 'projects', duration: 0 }]);
    expect(external).toHaveBeenCalledOnceWith('https://github.com/bigfoot1144');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  }));

  it('prefetches only on intent and pans focused shops into view', fakeAsync(() => {
    initialize(true);
    component.focusShop('projects');
    component.focusShop('learning');
    component.prefetchShop('learning');
    flushMicrotasks();
    expect(runtime.focused).toEqual(['projects', 'learning']);
    expect(prefetch.calls.allArgs()).toEqual([['projects'], ['learning']]);
  }));

  it('does not move a shop away while pointer focus is waiting for its click', fakeAsync(() => {
    initialize(true);
    const link = fixture.nativeElement.querySelector('[data-shop="blog"]') as HTMLElement;
    spyOn(link, 'matches').and.returnValue(false);
    component.focusShop('blog', { target: link } as unknown as FocusEvent);
    expect(runtime.focused).toEqual([]);
    expect(prefetch).toHaveBeenCalledWith('blog');
  }));

  it('returns to the overview when routing is cancelled or rejects', fakeAsync(() => {
    initialize(true);
    router.navigateByUrl.and.returnValue(Promise.resolve(false));
    component.activateShop('blog');
    clock.advance(900);
    flushMicrotasks();
    expect(component.state()).toBe('ready');
    router.navigateByUrl.and.callFake(() => Promise.reject(new Error('route failed')));
    component.activateShop('about');
    clock.advance(900);
    flushMicrotasks();
    expect(component.state()).toBe('ready');
    expect(component.selected()).toBeNull();
  }));

  it('falls back cleanly if browser runtime initialization rejects', fakeAsync(() => {
    factory.and.callFake(() => Promise.reject(new Error('WebGL unavailable')));
    initialize();
    fixture.detectChanges();
    expect(component.state()).toBe('error');
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('a').length).toBe(4);
    expect(clock.pendingCount).toBe(0);
  }));

  it('times out at 20 seconds, aborts the pending load and retains fallback links', fakeAsync(() => {
    initialize();
    clock.advance(LOAD_TIMEOUT_MS - 1);
    expect(component.state()).toBe('loading');
    clock.advance(1);
    fixture.detectChanges();
    expect(component.state()).toBe('error');
    expect(options.signal.aborted).toBeTrue();
    expect(runtime.disposed).toBeTrue();
    expect(fixture.nativeElement.querySelectorAll('a').length).toBe(4);
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('again');
    options.onFirstFrame();
    expect(component.firstFrame()).toBeFalse();
  }));

  it('allows an initially hidden load to show its first frame after returning to the foreground', fakeAsync(() => {
    const hidden = spyOnProperty(document, 'hidden', 'get').and.returnValue(true);
    initialize();
    expect(clock.pendingCount).toBe(0);
    clock.advance(120_000);
    expect(component.state()).toBe('loading');
    expect(runtime.disposed).toBeFalse();
    hidden.and.returnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(clock.pendingCount).toBe(1);
    options.onFirstFrame();
    fixture.detectChanges();
    expect(component.state()).toBe('ready');
    expect(clock.pendingCount).toBe(0);
    clock.advance(LOAD_TIMEOUT_MS);
    expect(runtime.disposed).toBeFalse();
  }));

  it('retains the remaining foreground loading budget across tab visibility changes', fakeAsync(() => {
    const hidden = spyOnProperty(document, 'hidden', 'get').and.returnValue(false);
    initialize();
    clock.advance(5000);
    hidden.and.returnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    clock.advance(60_000);
    expect(component.state()).toBe('loading');
    hidden.and.returnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    clock.advance(14_999);
    expect(component.state()).toBe('loading');
    clock.advance(1);
    expect(component.state()).toBe('error');
    expect(options.signal.aborted).toBeTrue();
    fixture.destroy();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(clock.pendingCount).toBe(0);
  }));

  it('falls back on WebGL context loss and retries with a fresh canvas/runtime', fakeAsync(() => {
    initialize(true);
    const firstCanvas = options.canvas;
    const oldOptions = options;
    options.onError(new Error('WebGL context lost'));
    fixture.detectChanges();
    expect(component.state()).toBe('error');
    expect(component.firstFrame()).toBeFalse();
    runtime = new MockStorefrontRuntime(clock);
    component.retry();
    flushMicrotasks();
    expect(factory).toHaveBeenCalledTimes(2);
    expect(options.canvas).not.toBe(firstCanvas);
    oldOptions.onFirstFrame();
    expect(component.state()).toBe('loading');
    options.onFirstFrame();
    expect(component.state()).toBe('ready');
  }));

  it('disposes a runtime whose factory resolves after destruction', fakeAsync(() => {
    let resolve!: (value: StorefrontRuntime) => void;
    factory.and.callFake((value: StorefrontRuntimeOptions) => {
      options = value;
      return new Promise<StorefrontRuntime>(done => resolve = done);
    });
    initialize();
    fixture.destroy();
    expect(options.signal.aborted).toBeTrue();
    resolve(runtime);
    flushMicrotasks();
    expect(runtime.disposed).toBeTrue();
    options.onFirstFrame();
    expect(component.firstFrame()).toBeFalse();
    expect(clock.pendingCount).toBe(0);
  }));

  it('disposes a late runtime after timeout and ignores all stale callbacks', fakeAsync(() => {
    let resolve!: (value: StorefrontRuntime) => void;
    factory.and.callFake((value: StorefrontRuntimeOptions) => {
      options = value;
      return new Promise<StorefrontRuntime>(done => resolve = done);
    });
    initialize();
    clock.advance(LOAD_TIMEOUT_MS);
    resolve(runtime);
    flushMicrotasks();
    options.onFirstFrame();
    options.onHover('learning');
    expect(runtime.disposed).toBeTrue();
    expect(component.state()).toBe('error');
    expect(prefetch).not.toHaveBeenCalled();
  }));

  it('cancels an in-progress navigation on destruction and removes browser listeners', fakeAsync(() => {
    initialize(true);
    component.activateShop('learning');
    fixture.destroy();
    clock.advance(5000);
    flushMicrotasks();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(runtime.disposed).toBeTrue();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(clock.pendingCount).toBe(0);
  }));

  it('resets the overview and duplicate guard after persisted pageshow', fakeAsync(() => {
    initialize(true);
    component.activateShop('projects');
    clock.advance(900);
    flushMicrotasks();
    expect(component.state()).toBe('navigating');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(component.state()).toBe('ready');
    expect(component.selected()).toBeNull();
    component.activateShop('blog');
    expect(runtime.approaches.length).toBe(2);
  }));

  it('focuses the destination heading after successful internal navigation', fakeAsync(() => {
    initialize(true);
    const heading = document.createElement('h1');
    document.body.prepend(heading);
    const focus = spyOn(heading, 'focus');
    component.activateShop('about');
    clock.advance(900);
    flushMicrotasks();
    expect(focus).toHaveBeenCalledOnceWith({ preventScroll: true });
    expect(heading.getAttribute('tabindex')).toBe('-1');
    heading.remove();
  }));

  it('exposes render metrics without adding normal on-screen UI', fakeAsync(() => {
    initialize(true);
    options.onMetrics({ calls: 12, triangles: 12345, frames: 1, camera: [0, 5, 25], fov: 40, pan: 0 });
    options.onProjection([{ id: 'learning', left: 10, top: 20, width: 100, height: 200, visible: true }]);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.dataset['drawCalls']).toBe('12');
    expect(host.dataset['renderedFrames']).toBe('1');
    expect(host.dataset['camera']).toBe('0.000,5.000,25.000');
    const link = host.querySelector<HTMLElement>('[data-shop="learning"]')!;
    expect(link.style.getPropertyValue('--shop-left')).toBe('10px');
    expect(link.dataset['visible']).toBe('true');
  }));
});
