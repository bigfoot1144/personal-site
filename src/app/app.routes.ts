import { Routes } from '@angular/router';
import { BioComponent } from './bio/bio.component';
import { BlogIndexComponent } from './blog/blog-index.component';
import { BLOG_POSTS } from './blog/blog-posts';

export const routes: Routes = [
  { path: '', component: BioComponent },
  { path: 'blog', component: BlogIndexComponent },
  ...BLOG_POSTS.map((post) => ({
    path: `blog/${post.slug}`,
    component: post.component
  })),
  { path: '**', redirectTo: '' }
];
