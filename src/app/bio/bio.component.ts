import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BLOG_POSTS } from '../blog/blog-posts';

@Component({
  selector: 'app-bio',
  standalone: true,
  imports: [RouterLink, NgFor],
  templateUrl: './bio.component.html',
  styleUrl: './bio.component.scss'
})
export class BioComponent {
  readonly blogPosts = BLOG_POSTS;
}
