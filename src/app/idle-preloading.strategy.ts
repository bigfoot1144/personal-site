import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IdlePreloadingStrategy implements PreloadingStrategy {
  private readonly platformId = inject(PLATFORM_ID);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!route.data?.['preload'] || !isPlatformBrowser(this.platformId)) return of(null);
    return new Observable(subscriber => {
      const start = () => load().subscribe(subscriber);
      const windowWithIdle = window as Window & { requestIdleCallback?: (callback: () => void) => number };
      const handle = windowWithIdle.requestIdleCallback
        ? windowWithIdle.requestIdleCallback(start)
        : window.setTimeout(start, 500);
      return () => {
        if ('cancelIdleCallback' in window) window.cancelIdleCallback(handle);
        else clearTimeout(handle);
      };
    });
  }
}
