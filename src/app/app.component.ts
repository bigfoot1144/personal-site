import { Component } from '@angular/core';
import { StarryBackgroundComponent } from './starry-background/starry-background.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [StarryBackgroundComponent],
  template: `
    <app-starry-background></app-starry-background>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
    }
  `]
})
export class AppComponent {}