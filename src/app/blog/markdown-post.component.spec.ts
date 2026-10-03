import { HttpClient } from '@angular/common/http';
import { Component, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { MarkdownPostComponent } from './markdown-post.component';

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<div class="content-overlay"><router-outlet></router-outlet></div>'
})
class TestBlogLayout {}

describe('MarkdownPostComponent reading progress', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MarkdownPostComponent],
      providers: [
        provideRouter([
          { path: 'blog', component: TestBlogLayout, children: [{ path: ':slug', component: MarkdownPostComponent }] },
          { path: '', component: TestBlogLayout }
        ]),
        { provide: HttpClient, useValue: { get: jasmine.createSpy('markdown').and.returnValue(of('# A post\n\nSome words to read.')) } }
      ]
    });
  });

  it('does not inspect browser scroll elements during server rendering', () => {
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    const fixture = TestBed.createComponent(MarkdownPostComponent);
    const closest = spyOn(fixture.nativeElement, 'closest');
    expect(() => fixture.detectChanges()).not.toThrow();
    // Also exercise the guard if setup is requested by a future lifecycle change.
    (fixture.componentInstance as any).setupReadingProgressTracking();
    expect(closest).not.toHaveBeenCalled();
    expect(fixture.componentInstance.readingProgress).toBe(0);
  });

  it('tracks and clamps progress using the preserved content-overlay scroll host', async () => {
    const harness = await RouterTestingHarness.create('/blog/hello-world');
    const element = harness.routeDebugElement!.query(By.directive(MarkdownPostComponent));
    const component = element.componentInstance as MarkdownPostComponent;
    const scrollHost = harness.routeNativeElement!.querySelector('.content-overlay') as HTMLElement;
    const article = element.nativeElement.querySelector('.post-page') as HTMLElement;
    Object.defineProperty(scrollHost, 'clientHeight', { value: 500, configurable: true });
    Object.defineProperty(article, 'offsetTop', { value: 100, configurable: true });
    Object.defineProperty(article, 'offsetHeight', { value: 1000, configurable: true });
    Object.defineProperty(scrollHost, 'scrollTop', { value: 350, writable: true, configurable: true });
    scrollHost.dispatchEvent(new Event('scroll'));
    expect(component.readingProgress).toBe(50);
    expect(component.renderedHtml).toContain('A post');
    scrollHost.scrollTop = 2000;
    scrollHost.dispatchEvent(new Event('scroll'));
    expect(component.readingProgress).toBe(100);
    scrollHost.scrollTop = -200;
    scrollHost.dispatchEvent(new Event('scroll'));
    expect(component.readingProgress).toBe(0);
  });

  it('unsubscribes from the old scroll host when navigating away', async () => {
    const harness = await RouterTestingHarness.create('/blog/hello-world');
    const element = harness.routeDebugElement!.query(By.directive(MarkdownPostComponent));
    const component = element.componentInstance as MarkdownPostComponent;
    const scrollHost = harness.routeNativeElement!.querySelector('.content-overlay') as HTMLElement;
    await harness.navigateByUrl('/');
    component.readingProgress = 41;
    scrollHost.dispatchEvent(new Event('scroll'));
    expect(component.readingProgress).toBe(41);
  });
});
