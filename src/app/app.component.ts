import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { StarryBackgroundComponent } from './starry-background/starry-background.component';
import { SparkleCursorComponent } from './sparkle-cursor/sparkle-cursor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [StarryBackgroundComponent, SparkleCursorComponent, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  knowledgeMode = false;

  constructor(router: Router) {
    this.knowledgeMode = router.url.startsWith('/knowledge');
    router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
      this.knowledgeMode = (event as NavigationEnd).urlAfterRedirects.startsWith('/knowledge');
    });
  }
}
