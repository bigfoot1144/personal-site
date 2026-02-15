import { Routes } from '@angular/router';
import { BioComponent } from './bio/bio.component';
import { BlogIndexComponent } from './blog/blog-index.component';
import { MarkdownPostComponent } from './blog/markdown-post.component';

export const routes: Routes = [
  { path: '', component: BioComponent },
  { path: 'blog', component: BlogIndexComponent },
  { path: 'blog/:slug', component: MarkdownPostComponent },
  { path: '**', redirectTo: '' }
];
