import { Component } from '@angular/core';
import { StarryBackgroundComponent } from './starry-background/starry-background.component';
import { BioComponent } from './bio/bio.component';
import { SparkleCursorComponent } from './sparkle-cursor/sparkle-cursor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [StarryBackgroundComponent, BioComponent, SparkleCursorComponent],
  templateUrl: './app.component.html', // Changed from 'template' to 'templateUrl'
  styleUrls: ['./app.component.scss']
})
export class AppComponent {}