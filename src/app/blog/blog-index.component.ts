import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BLOG_POSTS } from './blog-posts';

@Component({
  selector: 'app-blog-index',
  standalone: true,
  imports: [NgFor, RouterLink],
  templateUrl: './blog-index.component.html',
  styleUrl: './blog-index.component.scss'
})
export class BlogIndexComponent {
  readonly posts = BLOG_POSTS;
}
