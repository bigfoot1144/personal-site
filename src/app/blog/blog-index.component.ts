import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BLOG_POSTS, type BlogPost } from './blog-posts';

@Component({
  selector: 'app-blog-index',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './blog-index.component.html',
  styleUrl: './blog-index.component.scss'
})
export class BlogIndexComponent {
  readonly posts = BLOG_POSTS;
  readonly featuredPost = this.posts[1] ?? null;
  readonly otherPosts = this.posts.slice(1);

  tagsFor(post: BlogPost): string[] {
    return post.tags && post.tags.length > 0 ? post.tags : ['Devlog'];
  }
}
