import { Component, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { switchMap } from 'rxjs/operators';
import { catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BLOG_POSTS, type BlogPost } from './blog-posts';
import { MarkdownConverter } from './markdown/markdown-converter';

@Component({
  selector: 'app-markdown-post',
  standalone: true,
  imports: [NgIf, RouterLink],
  templateUrl: './markdown-post.component.html',
  styleUrl: './post-page.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class MarkdownPostComponent {
  post: BlogPost | null = null;
  renderedHtml = '';

  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const slug = params.get('slug');
          const post = slug ? BLOG_POSTS.find((item) => item.slug === slug) ?? null : null;

          if (!post) {
            this.post = null;
            this.renderedHtml = '';
            return of(null);
          }

          this.post = post;
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
      });
  }
}
