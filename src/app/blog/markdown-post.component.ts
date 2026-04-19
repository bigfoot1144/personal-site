import { Component, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
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

  constructor() {
    this.setupReadingProgressTracking();

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
    const scrollHost = document.querySelector('.content-overlay');
    if (!(scrollHost instanceof HTMLElement)) {
      return;
    }

    fromEvent(scrollHost, 'scroll')
      .pipe(startWith(null), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.readingProgress = calculateReadingProgress(scrollHost);
      });
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

function calculateReadingProgress(scrollHost: HTMLElement): number {
  const article = document.querySelector('.post-page');
  if (!(article instanceof HTMLElement)) {
    return 0;
  }

  const scrollTop = scrollHost.scrollTop;
  const viewportHeight = scrollHost.clientHeight;
  const articleTop = article.offsetTop;
  const articleHeight = article.offsetHeight;

  const progressPixels = scrollTop + viewportHeight * 0.2 - articleTop;
  const totalPixels = Math.max(articleHeight - viewportHeight * 0.6, 1);
  const percent = (progressPixels / totalPixels) * 100;

  return Math.max(0, Math.min(100, percent));
}
