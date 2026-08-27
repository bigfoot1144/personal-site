import { Component } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { ConstellationTransitionService } from './constellation-transition.service';
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
  private wasKnowledgeMode = false;

  constructor(router: Router, private readonly constellationTransition: ConstellationTransitionService) {
    this.knowledgeMode = router.url.startsWith('/knowledge');
    this.wasKnowledgeMode = this.knowledgeMode;
    router.events.subscribe(event => {
      if (event instanceof NavigationStart && this.wasKnowledgeMode && !event.url.startsWith('/knowledge')) {
        this.constellationTransition.captureExitSnapshot();
      }
      if (event instanceof NavigationEnd) {
        const nextKnowledgeMode = event.urlAfterRedirects.startsWith('/knowledge');
        if (this.wasKnowledgeMode && !nextKnowledgeMode) this.constellationTransition.scatterFromKnowledge();
        this.knowledgeMode = nextKnowledgeMode;
        this.wasKnowledgeMode = nextKnowledgeMode;
      }
    });
  }
}
