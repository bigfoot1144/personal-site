import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./storefront/storefront.component').then(module => module.StorefrontComponent)
  },
  {
    path: '',
    loadComponent: () => import('./content-layout/content-layout.component').then(module => module.ContentLayoutComponent),
    children: [
      { path: 'about', loadComponent: () => import('./bio/bio.component').then(module => module.BioComponent) },
      { path: 'knowledge', loadComponent: () => import('./knowledge/knowledge.component').then(module => module.KnowledgeComponent) },
      { path: 'blog', loadComponent: () => import('./blog/blog-index.component').then(module => module.BlogIndexComponent) },
      { path: 'blog/:slug', loadComponent: () => import('./blog/markdown-post.component').then(module => module.MarkdownPostComponent) }
    ]
  },
  { path: '**', redirectTo: '' }
];
