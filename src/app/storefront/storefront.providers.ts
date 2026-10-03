import { InjectionToken } from '@angular/core';
import type { StorefrontClock, StorefrontId, StorefrontRuntimeFactory } from './storefront.types';

/** Importing the component never imports Three or touches a browser global. */
export const STOREFRONT_RUNTIME_FACTORY = new InjectionToken<StorefrontRuntimeFactory>('Storefront runtime factory', {
  providedIn: 'root',
  factory: () => async options => {
    const runtime = await import('./storefront.runtime');
    if (options.signal.aborted) throw new DOMException('Storefront cancelled', 'AbortError');
    return runtime.createStorefrontRuntime(options);
  }
});

export const STOREFRONT_CLOCK = new InjectionToken<StorefrontClock>('Storefront clock', {
  providedIn: 'root',
  factory: () => ({
    now: () => performance.now(),
    requestFrame: callback => requestAnimationFrame(callback),
    cancelFrame: id => cancelAnimationFrame(id),
    setTimeout: (callback, milliseconds) => window.setTimeout(callback, milliseconds),
    clearTimeout: id => window.clearTimeout(id)
  })
});

export const STOREFRONT_PREFETCH = new InjectionToken<(id: StorefrontId) => Promise<unknown>>('Storefront intent prefetch', {
  providedIn: 'root',
  factory: () => id => {
    switch (id) {
      case 'learning': return import('../knowledge/knowledge.component');
      case 'blog': return import('../blog/blog-index.component');
      case 'about': return import('../bio/bio.component');
      case 'projects': return Promise.resolve();
    }
  }
});

export const STOREFRONT_EXTERNAL_NAVIGATE = new InjectionToken<(href: string) => void>('Storefront external navigation', {
  providedIn: 'root',
  factory: () => href => window.location.assign(href)
});
