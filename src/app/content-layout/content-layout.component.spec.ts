import { Component, Input, OnDestroy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DefaultUrlSerializer, NavigationCancel, NavigationEnd, NavigationStart, provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { routes } from '../app.routes';
import { ConstellationTransitionService } from '../constellation-transition.service';
import { SparkleCursorComponent } from '../sparkle-cursor/sparkle-cursor.component';
import { StarryBackgroundComponent } from '../starry-background/starry-background.component';
import { ContentLayoutComponent } from './content-layout.component';

@Component({ standalone: true, template: '<p>Storefront</p>' })
class TestStorefront {}
@Component({ standalone: true, template: '<p>Content</p>' })
class TestContent {}
const lifecycle: string[] = [];
@Component({ standalone: true, template: '<p>Knowledge</p>' })
class TestKnowledge implements OnDestroy {
  ngOnDestroy(): void { lifecycle.push('knowledge destroyed'); }
}
@Component({ selector: 'app-starry-background', standalone: true, template: '' })
class TestStars { @Input() knowledgeMode = false; }
@Component({ selector: 'app-sparkle-cursor', standalone: true, template: '' })
class TestSparkles {}

function stubEffects(): void {
  TestBed.overrideComponent(ContentLayoutComponent, {
    remove: { imports: [StarryBackgroundComponent, SparkleCursorComponent] },
    add: { imports: [TestStars, TestSparkles] }
  });
}

function transitionSpy() {
  return jasmine.createSpyObj<ConstellationTransitionService>('transition', [
    'captureExitSnapshot', 'discardExitSnapshot', 'scatterFromKnowledge', 'reset'
  ]);
}

describe('Content routes', () => {
  let transition: ReturnType<typeof transitionSpy>;
  let harness: RouterTestingHarness;
  let loadLayout: jasmine.Spy;
  let loadKnowledge: jasmine.Spy;

  beforeEach(async () => {
    transition = transitionSpy();
    lifecycle.length = 0;
    transition.captureExitSnapshot.and.callFake(() => { lifecycle.push('snapshot'); });
    loadLayout = jasmine.createSpy('load layout').and.resolveTo(ContentLayoutComponent);
    loadKnowledge = jasmine.createSpy('load knowledge').and.resolveTo(TestKnowledge);
    const testRoutes: Routes = [
      { ...routes[0], loadComponent: () => Promise.resolve(TestStorefront) },
      {
        ...routes[1], loadComponent: loadLayout,
        children: routes[1].children!.map(route => ({
          ...route,
          loadComponent: route.path === 'knowledge' ? loadKnowledge : () => Promise.resolve(TestContent)
        }))
      },
      routes[2]
    ];
    TestBed.configureTestingModule({
      providers: [provideRouter(testRoutes), { provide: ConstellationTransitionService, useValue: transition }]
    });
    stubEffects();
    harness = await RouterTestingHarness.create();
  });

  it('keeps storefront, content layout, and every existing page lazy with no knowledge auto-preload', () => {
    expect(routes[0].path).toBe('');
    expect(routes[0].pathMatch).toBe('full');
    expect(routes[0].loadComponent).toEqual(jasmine.any(Function));
    expect(routes[1].path).toBe('');
    expect(routes[1].loadComponent).toEqual(jasmine.any(Function));
    expect(routes[1].children!.map(route => route.path)).toEqual(['about', 'knowledge', 'blog', 'blog/:slug']);
    for (const route of [routes[0], routes[1], ...routes[1].children!]) {
      expect(route.component).toBeUndefined();
      expect(route.loadComponent).toEqual(jasmine.any(Function));
      expect(route.data?.['preload']).not.toBeTrue();
    }
    expect(routes[2]).toEqual({ path: '**', redirectTo: '' });
  });

  it('does not load the original shell or knowledge on home, including query strings', async () => {
    await harness.navigateByUrl('/?welcome=1#home', TestStorefront);
    expect(loadLayout).not.toHaveBeenCalled();
    expect(loadKnowledge).not.toHaveBeenCalled();
    expect(harness.routeNativeElement?.querySelector('.content-overlay')).toBeNull();
  });

  it('wraps /about, /blog, and direct blog slugs in the original scroll host', async () => {
    for (const url of ['/about', '/blog', '/blog/hello-world']) {
      await harness.navigateByUrl(url);
      const overlay = harness.routeNativeElement?.querySelector('.content-overlay');
      expect(overlay).withContext(url).not.toBeNull();
      expect(overlay?.classList.contains('knowledge-mode')).toBeFalse();
      expect(overlay?.querySelector('.page-host')).not.toBeNull();
    }
    expect(loadKnowledge).not.toHaveBeenCalled();
  });

  it('captures before knowledge destruction and scatters only into a content page', async () => {
    await harness.navigateByUrl('/knowledge');
    expect(harness.routeNativeElement?.querySelector('.content-overlay.knowledge-mode')).not.toBeNull();
    await harness.navigateByUrl('/about');
    expect(lifecycle).toEqual(['snapshot', 'knowledge destroyed']);
    expect(transition.scatterFromKnowledge).toHaveBeenCalledTimes(1);
    expect(harness.routeNativeElement?.querySelector('.knowledge-mode')).toBeNull();
  });

  it('destroys and resets the shell without scattering into storefront', async () => {
    await harness.navigateByUrl('/knowledge');
    await harness.navigateByUrl('/', TestStorefront);
    expect(transition.captureExitSnapshot).toHaveBeenCalledTimes(1);
    expect(transition.scatterFromKnowledge).not.toHaveBeenCalled();
    expect(transition.reset).toHaveBeenCalledTimes(1);
    expect(harness.routeNativeElement?.querySelector('.content-overlay')).toBeNull();
    await harness.navigateByUrl('/about');
    expect(transition.scatterFromKnowledge).not.toHaveBeenCalled();
    expect(harness.routeNativeElement?.querySelector('.knowledge-mode')).toBeNull();
  });

  it('redirects unknown URLs to the storefront without leaving content effects mounted', async () => {
    await harness.navigateByUrl('/knowledge');
    await harness.navigateByUrl('/unknown/page', TestStorefront);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(transition.scatterFromKnowledge).not.toHaveBeenCalled();
    expect(transition.reset).toHaveBeenCalledTimes(1);
  });
});

describe('ContentLayoutComponent route subscription lifetime', () => {
  it('discards cancelled snapshots and stops observing routes after destruction', async () => {
    const events = new Subject<unknown>();
    const transition = transitionSpy();
    const serializer = new DefaultUrlSerializer();
    const parseUrl = (url: string) => serializer.parse(url);
    TestBed.configureTestingModule({
      imports: [ContentLayoutComponent],
      providers: [
        { provide: ConstellationTransitionService, useValue: transition },
        { provide: Router, useValue: { events, url: '/knowledge', parseUrl, getCurrentNavigation: () => null } }
      ]
    });
    TestBed.overrideComponent(ContentLayoutComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(ContentLayoutComponent);
    events.next(new NavigationStart(1, '/about'));
    events.next(new NavigationCancel(1, '/about', 'cancelled'));
    expect(transition.captureExitSnapshot).toHaveBeenCalledTimes(1);
    expect(transition.discardExitSnapshot).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.knowledgeMode).toBeTrue();
    fixture.destroy();
    events.next(new NavigationStart(2, '/about'));
    events.next(new NavigationEnd(2, '/about', '/about'));
    expect(transition.captureExitSnapshot).toHaveBeenCalledTimes(1);
    expect(transition.scatterFromKnowledge).not.toHaveBeenCalled();
    expect(transition.reset).toHaveBeenCalledTimes(1);
  });
});
