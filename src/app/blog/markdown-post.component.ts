import { afterNextRender, ChangeDetectorRef, Component, DestroyRef, ElementRef, NgZone, PLATFORM_ID, ViewEncapsulation, inject } from '@angular/core';
import { isPlatformBrowser, NgFor, NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { switchMap } from 'rxjs/operators';
import { catchError, fromEvent, of, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BLOG_POSTS, type BlogPost } from './blog-posts';
import { MarkdownConverter } from './markdown/markdown-converter';

@Component({
  selector: 'app-markdown-post',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './markdown-post.component.html',
  styleUrl: './post-page.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class MarkdownPostComponent {
  post: BlogPost | null = null;
  renderedHtml = '';
  postTags: string[] = [];
  readingTimeMinutes = 1;
  readingProgress = 0;

  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private destroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => { this.destroyed = true; });
    afterNextRender(() => this.setupReadingProgressTracking());

    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const slug = params.get('slug');
          const post = slug ? BLOG_POSTS.find((item) => item.slug === slug) ?? null : null;

          if (!post) {
            this.post = null;
            this.postTags = [];
            this.renderedHtml = '';
            this.readingTimeMinutes = 1;
            this.readingProgress = 0;
            return of(null);
          }

          this.post = post;
          this.postTags = post.tags && post.tags.length > 0 ? post.tags : ['Devlog'];

          return this.http.get(post.markdownPath, { responseType: 'text' }).pipe(
            catchError(() => {
              return of('Unable to load this markdown post right now.');
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((markdown) => {
        if (!markdown) {
          return;
        }

        this.renderedHtml = MarkdownConverter.convert(markdown);
        this.readingTimeMinutes = estimateReadingTime(markdown);
      });
  }

  private setupReadingProgressTracking(): void {
    if (!this.isBrowser || this.destroyed) return;
    const scrollHost = this.element.nativeElement.closest<HTMLElement>('.content-overlay');
    if (!scrollHost) return;

    fromEvent(scrollHost, 'scroll')
      .pipe(startWith(null), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.zone.run(() => {
        const article = this.element.nativeElement.querySelector<HTMLElement>('.post-page');
        this.readingProgress = article ? calculateReadingProgress(scrollHost, article) : 0;
        this.changeDetector.markForCheck();
      }));
  }
}

function estimateReadingTime(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 220));
}

function calculateReadingProgress(scrollHost: HTMLElement, article: HTMLElement): number {
  const scrollTop = scrollHost.scrollTop;
  const viewportHeight = scrollHost.clientHeight;
  const articleTop = article.offsetTop;
  const articleHeight = article.offsetHeight;

  const progressPixels = scrollTop + viewportHeight * 0.2 - articleTop;
  const totalPixels = Math.max(articleHeight - viewportHeight * 0.6, 1);
  const percent = (progressPixels / totalPixels) * 100;

  return Math.max(0, Math.min(100, percent));
}
