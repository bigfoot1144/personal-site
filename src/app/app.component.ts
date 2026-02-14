import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StarryBackgroundComponent } from './starry-background/starry-background.component';
import { SparkleCursorComponent } from './sparkle-cursor/sparkle-cursor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [StarryBackgroundComponent, SparkleCursorComponent, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {}
