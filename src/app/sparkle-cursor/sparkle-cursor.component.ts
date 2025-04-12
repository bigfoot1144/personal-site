import { Component, OnInit, OnDestroy, ElementRef, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-sparkle-cursor',
  standalone: true,
  imports: [],
  template: '',
  styleUrl: './sparkle-cursor.component.scss'
})
export class SparkleCursorComponent implements OnInit, OnDestroy {
  private customCursor: HTMLElement | null = null;
  private sparkles: HTMLElement[] = [];
  private isBrowser: boolean;
  private sparkleInterval: any;
  private mouseX = 0;
  private mouseY = 0;

  constructor(
    private el: ElementRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnInit() {
    // Only execute browser-specific code if we're in a browser
    if (this.isBrowser) {
      this.createCustomCursor();
      document.body.appendChild(this.customCursor!); // Append cursor to the body
      this.sparkleInterval = setInterval(() => this.updateSparkles(), 50);
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      if (this.sparkleInterval) {
        clearInterval(this.sparkleInterval);
      }
      if (this.customCursor) {
        document.body.removeChild(this.customCursor);
      }
      this.sparkles.forEach(sparkle => {
        if (sparkle.parentNode) {
          sparkle.parentNode.removeChild(sparkle);
        }
      });
      this.sparkles = [];
    }
  }

  private createCustomCursor(): void {
    // Create custom cursor
    this.customCursor = document.createElement('div');
    this.customCursor.style.position = 'fixed'; // Use 'fixed' to position relative to viewport
    this.customCursor.style.width = '8px';
    this.customCursor.style.height = '8px';
    this.customCursor.style.borderRadius = '50%';
    this.customCursor.style.backgroundColor = '#ffffff';
    this.customCursor.style.boxShadow = '0 0 10px #ffffff, 0 0 20px #aaaaff';
    this.customCursor.style.pointerEvents = 'none'; // Set pointer-events to none here
    this.customCursor.style.zIndex = '1000';
    this.customCursor.style.transform = 'translate(-50%, -50%)';
  }

  private getRandomSparkleColor(): string {
    const colors = ['#ffffff', '#aaaaff', '#ffaaaa', '#ffffaa', '#aaffaa', '#ffaaff'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  @HostListener('document:mousemove', ['$event']) // Changed to document:mousemove
  onMouseMove(event: MouseEvent): void {
    if (!this.isBrowser || !this.customCursor) return; // Ensure customCursor exists
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;

    // Update custom cursor position
    this.customCursor.style.left = `${this.mouseX}px`;
    this.customCursor.style.top = `${this.mouseY}px`;
  }

  private updateSparkles(): void {
    // Append sparkles directly to the body
    const container = document.body;

    // Clean up old sparkles
    this.sparkles.forEach((sparkle, index) => {
      if (parseFloat(sparkle.style.opacity) <= 0.1) {
        if (sparkle.parentNode) {
          sparkle.parentNode.removeChild(sparkle);
        }
        this.sparkles.splice(index, 1);
      } else {
        sparkle.style.opacity = (parseFloat(sparkle.style.opacity) - 0.5).toString();
      }
    });

    // Add new sparkle at cursor position
    if (this.mouseX > 0 && this.mouseY > 0) {
      const sparkle = document.createElement('div');

      sparkle.style.position = 'fixed'; // Use 'fixed' for sparkles too
      sparkle.style.width = `${2 + Math.random() * 3}px`;
      sparkle.style.height = sparkle.style.width;
      sparkle.style.backgroundColor = this.getRandomSparkleColor();
      sparkle.style.borderRadius = '50%';
      sparkle.style.pointerEvents = 'none';
      sparkle.style.zIndex = '999';

      // Position with slight random offset from cursor
      sparkle.style.left = `${this.mouseX + (Math.random() * 20 - 10)}px`;
      sparkle.style.top = `${this.mouseY + (Math.random() * 20 - 10)}px`;

      sparkle.style.opacity = '1';
      sparkle.style.transition = 'opacity 1s';

      container.appendChild(sparkle);
      this.sparkles.push(sparkle);
    }
  }
}