import { NgZone } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ONNX_RUNTIME_LOADER, StarryBackgroundComponent } from './starry-background.component';

describe('StarryBackgroundComponent', () => {
  let component: StarryBackgroundComponent;
  let fixture: ComponentFixture<StarryBackgroundComponent>;
  let loadRuntime: jasmine.Spy;
  let createSession: jasmine.Spy;
  let session: { release: jasmine.Spy; run: jasmine.Spy; inputNames: string[]; outputNames: string[] };
  let runtime: unknown;

  beforeEach(async () => {
    session = {
      release: jasmine.createSpy('release').and.resolveTo(),
      run: jasmine.createSpy('run').and.resolveTo({ output: { data: new Float32Array([1]) } }),
      inputNames: ['input'], outputNames: ['output']
    };
    createSession = jasmine.createSpy('create session').and.resolveTo(session);
    runtime = { env: { wasm: {} }, InferenceSession: { create: createSession }, Tensor: class {} };
    loadRuntime = jasmine.createSpy('load runtime').and.resolveTo(runtime);
    await TestBed.configureTestingModule({
      imports: [StarryBackgroundComponent],
      providers: [{ provide: ONNX_RUNTIME_LOADER, useValue: loadRuntime }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StarryBackgroundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('keeps an expanded reserve of random stars in the nearest foreground depth', () => {
    const stars = Array.from(fixture.nativeElement.querySelectorAll('.ambient-star')) as HTMLElement[];
    expect(stars.length).toBe(380);
    expect(stars.slice(200).every(star => star.dataset['depthLayer'] === '2')).toBeTrue();
  });

  it('moves faint stars with overview parallax and freezes them in detail views', () => {
    component.knowledgeMode = true;
    const stars = fixture.nativeElement.querySelectorAll('.ambient-star') as NodeListOf<HTMLElement>;
    const star = stars[0];
    (component as any).ambientOrigins[0] = { x: .5, y: .5 };
    (component as any).ambientOrigins[1] = { x: .5, y: .5 };
    (component as any).ambientOrigins[2] = { x: .5, y: .5 };
    component.updateKnowledgeCamera({
      scale: 2,
      panX: 120,
      panY: -60,
      parallaxX: 120,
      parallaxY: -60,
      viewportWidth: 1000,
      viewportHeight: 700,
      parallaxActive: true
    });
    expect(star.style.left).toContain('px');
    expect(star.style.opacity).toBe('0.38');
    expect(stars[1].style.opacity).toBe('0.52');
    expect(stars[2].style.opacity).toBe('0.72');
    expect(parseFloat(stars[0].style.left)).toBeLessThan(parseFloat(stars[1].style.left));
    expect(parseFloat(stars[1].style.left)).toBeLessThan(parseFloat(stars[2].style.left));

    const zoomStableLeft = star.style.left;
    const zoomStableTop = star.style.top;
    component.updateKnowledgeCamera({
      scale: 3, panX: -500, panY: 240, parallaxX: 120, parallaxY: -60,
      viewportWidth: 1000, viewportHeight: 700, parallaxActive: true
    });
    expect(star.style.left).toBe(zoomStableLeft);
    expect(star.style.top).toBe(zoomStableTop);

    const frozenLeft = star.style.left;
    const frozenTop = star.style.top;
    component.updateKnowledgeCamera({
      scale: 3,
      panX: -400,
      panY: 300,
      parallaxX: -400,
      parallaxY: 300,
      viewportWidth: 1000,
      viewportHeight: 700,
      parallaxActive: false
    });
    expect(star.style.left).toBe(frozenLeft);
    expect(star.style.top).toBe(frozenTop);
  });

  it('hands mapped ambient stars to the constellation without duplicate cores', async () => {
    component.knowledgeMode = true;
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    await component.morphToConstellation([
      { id: 'root', x: 240, y: 180, size: 5, color: 'rgb(125, 249, 255)' }
    ]);

    const stars = fixture.nativeElement.querySelectorAll('.ambient-star') as NodeListOf<HTMLElement>;
    expect(stars[0].style.left).toBe('237.5px');
    expect(stars[0].style.top).toBe('177.5px');
    expect(stars[0].style.opacity).toBe('0');
    expect(stars[1].style.opacity).toBe('0.52');
    expect(fixture.nativeElement.querySelectorAll('.shooting-star').length).toBe(0);
  });

  it('starts effects outside Angular so their recurring timers do not block hydration', () => {
    const zones: boolean[] = [];
    spyOn<any>(component, 'createShootingStars').and.callFake(() => zones.push(NgZone.isInAngularZone()));
    TestBed.inject(NgZone).run(() => component.restartShootingStarEffect());
    expect(zones).toEqual([false]);
    expect(loadRuntime).toHaveBeenCalledTimes(1);
  });

  it('removes owned styles, drawing timers, stars and the model session on destroy', async () => {
    component.onMouseDown();
    component.onMouseMove(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
    component.onMouseMove(new MouseEvent('mousemove', { clientX: 20, clientY: 20 }));
    const style = document.head.querySelector('style[data-starry-background]');
    expect(style).not.toBeNull();
    expect((component as any).timeouts.size).toBeGreaterThan(0);
    fixture.destroy();
    expect(style?.isConnected).toBeFalse();
    expect((component as any).timeouts.size).toBe(0);
    expect((component as any).stars.length).toBe(0);
    expect((component as any).shootingStarInterval).toBeNull();
    expect(session.release).toHaveBeenCalledTimes(1);
  });

  it('settles a running morph and cancels scatter callbacks when unmounted', async () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    const cancelled = spyOn(window, 'cancelAnimationFrame').and.callThrough();
    const morph = component.morphToConstellation([{ id: 'a', x: 10, y: 20, size: 4, color: '#fff' }]);
    component.scatterToRandom([]);
    fixture.destroy();
    await morph;
    expect(cancelled).toHaveBeenCalled();
    expect((component as any).transitionTimer).toBeNull();
    expect((component as any).transitionFrame).toBeNull();
    expect((component as any).shootingStarInterval).toBeNull();
  });

  it('does not let a late cancelled timer clear a newer morph generation', async () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    const callbacks: Array<() => void> = [];
    const setTimeout = window.setTimeout;
    spyOn(window, 'setTimeout').and.callFake(((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 900 && typeof callback === 'function') {
        callbacks.push(callback as () => void);
        return 10000 + callbacks.length;
      }
      return setTimeout(callback, delay, ...args);
    }) as typeof window.setTimeout);
    const target = [{ id: 'a', x: 10, y: 20, size: 4, color: '#fff' }];
    const first = component.morphToConstellation(target);
    const second = component.morphToConstellation(target);
    const currentTimer = (component as any).transitionTimer;
    callbacks[0](); // Simulate a cancelled callback already queued for delivery.
    expect((component as any).transitionTimer).toBe(currentTimer);
    expect((component as any).resolveTransition).not.toBeNull();
    fixture.destroy();
    await Promise.all([first, second]);
  });

  it('releases a model that finishes loading after unmount instead of adopting it', async () => {
    fixture.destroy();
    session.release.calls.reset();
    let finish!: (value: unknown) => void;
    createSession.and.returnValue(new Promise(resolve => { finish = resolve; }));
    fixture = TestBed.createComponent(StarryBackgroundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.destroy();
    finish(session);
    await Promise.resolve();
    await Promise.resolve();
    expect(session.release).toHaveBeenCalledTimes(1);
    expect((component as any).session).toBeNull();
  });

  it('does not create a model if the runtime import completes after unmount', async () => {
    fixture.destroy();
    createSession.calls.reset();
    let finish!: (value: unknown) => void;
    loadRuntime.and.returnValue(new Promise(resolve => { finish = resolve; }));
    fixture = TestBed.createComponent(StarryBackgroundComponent);
    fixture.detectChanges();
    fixture.destroy();
    finish(runtime);
    await Promise.resolve();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('ignores inference results that return after unmount', async () => {
    let finish!: (value: unknown) => void;
    session.run.and.returnValue(new Promise(resolve => { finish = resolve; }));
    (component as any).resized = Array.from({ length: 28 }, () => Array(28).fill(0));
    const restart = spyOn(component, 'restartShootingStarEffect');
    const inference = (component as any).runInference();
    fixture.destroy();
    finish({ output: { data: new Float32Array([1]) } });
    await inference;
    expect(restart).not.toHaveBeenCalled();
  });

});
