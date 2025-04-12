import { Component } from '@angular/core';
import { StarryBackgroundComponent } from './starry-background/starry-background.component';
import { BioComponent } from './bio/bio.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [StarryBackgroundComponent, BioComponent],
  templateUrl: './app.component.html', // Changed from 'template' to 'templateUrl'
  styleUrls: ['./app.component.scss']
})
export class AppComponent {}