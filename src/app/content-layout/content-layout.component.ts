import { Component, DestroyRef, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, PRIMARY_OUTLET, Router, RouterOutlet } from '@angular/router';
import { ConstellationTransitionService } from '../constellation-transition.service';
import { SparkleCursorComponent } from '../sparkle-cursor/sparkle-cursor.component';
import { StarryBackgroundComponent } from '../starry-background/starry-background.component';

@Component({
  selector: 'app-content-layout',
  standalone: true,
  imports: [RouterOutlet, SparkleCursorComponent, StarryBackgroundComponent],
  templateUrl: './content-layout.component.html',
  styleUrl: './content-layout.component.scss'
})
export class ContentLayoutComponent implements OnDestroy {
  knowledgeMode = false;

  constructor(
    private readonly router: Router,
    private readonly constellationTransition: ConstellationTransitionService,
    destroyRef: DestroyRef
  ) {
    const initialUrl = router.getCurrentNavigation()?.finalUrl?.toString() ?? router.url;
    this.knowledgeMode = this.isKnowledgeUrl(initialUrl);
    router.events.pipe(takeUntilDestroyed(destroyRef)).subscribe(event => {
      if (event instanceof NavigationStart && this.knowledgeMode && !this.isKnowledgeUrl(event.url)) {
        // Capture before the outgoing knowledge component and its SVG are destroyed.
        this.constellationTransition.captureExitSnapshot();
      }
      if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.constellationTransition.discardExitSnapshot();
      }
      if (event instanceof NavigationEnd) {
        const nextKnowledgeMode = this.isKnowledgeUrl(event.urlAfterRedirects);
        if (this.knowledgeMode && !nextKnowledgeMode && this.isContentUrl(event.urlAfterRedirects)) {
          this.constellationTransition.scatterFromKnowledge();
        }
        this.knowledgeMode = nextKnowledgeMode;
      }
    });
  }

  ngOnDestroy(): void {
    // The root-provided coordinator must never carry a content transition to the storefront.
    this.constellationTransition.reset();
  }

  private isKnowledgeUrl(url: string): boolean {
    const segments = this.pathSegments(url);
    return segments.length === 1 && segments[0] === 'knowledge';
  }

  private isContentUrl(url: string): boolean {
    const segments = this.pathSegments(url);
    return (segments.length === 1 && ['about', 'knowledge', 'blog'].includes(segments[0])) ||
      (segments.length === 2 && segments[0] === 'blog');
  }

  private pathSegments(url: string): string[] {
    return this.router.parseUrl(url).root.children[PRIMARY_OUTLET]?.segments.map(segment => segment.path) ?? [];
  }
}
