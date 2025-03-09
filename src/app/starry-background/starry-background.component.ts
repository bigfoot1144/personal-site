import { Component, OnInit, OnDestroy, ElementRef, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-starry-background',
  standalone: true,
  template: `
    <div class="starry-background" #starryBackground></div>
  `,
  styles: [`
    .starry-background {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(to bottom, #000033 0%,rgb(0, 0, 102) 100%);
      overflow: hidden;
      cursor: none; /* Hide the default cursor */
    }

    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class StarryBackgroundComponent implements OnInit, OnDestroy {
  private stars: HTMLElement[] = [];
  private shootingStars: HTMLElement[] = [];
  private shootingStarInterval: any;
  private customCursor: HTMLElement | null = null;
  private sparkles: HTMLElement[] = [];
  private drawingLines: HTMLElement[] = [];
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private mouseX = 0;
  private mouseY = 0;
  private sparkleInterval: any;
  private current_pixel_val = 10;
  
  // Pixel font definitions for characters
  private pixelCharacters: number[][][] = [
    [
      [0,1,1,0],
      [1,0,0,1],
      [1,0,0,1],
      [1,0,0,1],
      [0,1,1,0]
    ],
    [
      [0,0,1,0],
      [0,1,1,0],
      [0,0,1,0],
      [0,0,1,0],
      [0,1,1,1]
    ],
    [
      [1,1,1,0],
      [0,0,0,1],
      [0,1,1,0],
      [1,0,0,0],
      [1,1,1,1]
    ],
    [
      [1,1,1,0],
      [0,0,0,1],
      [0,1,1,0],
      [0,0,0,1],
      [1,1,1,0]
    ],
    [
      [0,0,1,1],
      [0,1,0,1],
      [1,0,0,1],
      [1,1,1,1],
      [0,0,0,1]
    ],
    [
      [1,1,1,1],
      [1,0,0,0],
      [1,1,1,0],
      [0,0,0,1],
      [1,1,1,0]
    ],
    [
      [0,1,1,0],
      [1,0,0,0],
      [1,1,1,0],
      [1,0,0,1],
      [0,1,1,0]
    ],
    [
      [1,1,1,1],
      [0,0,0,1],
      [0,0,1,0],
      [0,1,0,0],
      [1,0,0,0]
    ],
    [
      [0,1,1,0],
      [1,0,0,1],
      [0,1,1,0],
      [1,0,0,1],
      [0,1,1,0]
    ],
    [
      [0,1,1,0],
      [1,0,0,1],
      [0,1,1,1],
      [0,0,0,1],
      [0,1,1,0]
    ],
    [
      [0,0,0,0],
      [1,1,0,0],
      [1,1,0,0],
      [0,0,0,0],
      [0,0,0,0]
    ]
  ];
  
  // New properties for drawing recording
  private drawingRecorder: number[][] = [];
  private canvasWidth = 0;
  private canvasHeight = 0;
  private isRecording = false;
  private recordingTimeout: any;
  private recordingDuration = 2000; // 2 seconds

  private topLeft = {row: 0, col: 0};
  private topRight = {row: 0, col: 0};
  private bottomLeft = {row: 0, col: 0};
  private bottomRight = {row: 0, col: 0};
  
  // Flag to check if we're running in browser
  private isBrowser: boolean;
  // Add this to your class properties
  private boundingBoxContainer: HTMLElement | null = null;

  constructor(
    private el: ElementRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnInit() {
    // Only execute browser-specific code if we're in a browser
    if (this.isBrowser) {
      // Initialize main starry background
      this.generateStars();
      this.createShootingStars();
      this.shootingStarInterval = setInterval(() => this.createShootingStars(), 4000);
      
      // Initialize cursor effects
      this.createCustomCursor();
      this.sparkleInterval = setInterval(() => this.updateSparkles(), 50);
      
      // Create styles for animations
      this.createAnimationStyles();
      
      // Initialize the drawing recorder
      this.initializeDrawingRecorder();
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      if (this.shootingStarInterval) {
        clearInterval(this.shootingStarInterval);
      }
      if (this.sparkleInterval) {
        clearInterval(this.sparkleInterval);
      }
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
      }
    }
  }

  private getMnistInputArray(lineThickness = 1): void {
    // Step 1: Extract bounding box coordinates with padding
    let minRow = this.topLeft.row;
    let maxRow = this.bottomLeft.row;
    let minCol = this.topLeft.col;
    let maxCol = this.topRight.col;
  
    // Calculate bounding box dimensions
    const bboxHeight = maxRow - minRow + 1;
    const bboxWidth = maxCol - minCol + 1;
    
    // Calculate padding (20% of the bounding box size)
    const paddingVertical = Math.ceil(bboxHeight * 0.2);
    const paddingHorizontal = Math.ceil(bboxWidth * 0.2);
    
    // Apply padding to the bounding box (with boundary checks)
    minRow = Math.max(0, minRow - paddingVertical);
    maxRow = Math.min(this.drawingRecorder.length - 1, maxRow + paddingVertical);
    minCol = Math.max(0, minCol - paddingHorizontal);
    maxCol = Math.min(this.drawingRecorder[0].length - 1, maxCol + paddingHorizontal);
    
    // Recalculate dimensions with padding
    const newBboxHeight = maxRow - minRow + 1;
    const newBboxWidth = maxCol - minCol + 1;
    const maxDim = Math.max(newBboxHeight, newBboxWidth);
  
    // Step 2: Create a square array for the padded bounding box
    const square = new Array(maxDim);
    for (let i = 0; i < maxDim; i++) {
      square[i] = new Array(maxDim).fill(0);
    }
    
    // Copy data into square array, centered
    const offsetRow = Math.floor((maxDim - newBboxHeight) / 2);
    const offsetCol = Math.floor((maxDim - newBboxWidth) / 2);
    
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        square[r - minRow + offsetRow][c - minCol + offsetCol] = this.drawingRecorder[r][c];
      }
    }
  
    // Step 3: Thicken the lines with configurable thickness
    // Calculate kernel size based on input parameter and scale
    const baseKernelSize = Math.max(1, Math.floor(maxDim / 112)); // Base thickness (smaller than before)
    const kernelSize = Math.max(1, Math.round(baseKernelSize * lineThickness));
    
    const thickened = new Array(maxDim);
    for (let i = 0; i < maxDim; i++) {
      thickened[i] = new Array(maxDim).fill(0);
    }
    
    for (let y = 0; y < maxDim; y++) {
      for (let x = 0; x < maxDim; x++) {
        // Only process this costly operation if there's content nearby
        if (square[y][x] > 0) {
          thickened[y][x] = 255;
          continue;
        }
        
        // Check neighborhood for content
        let hasContent = false;
        const yMin = Math.max(0, y - kernelSize);
        const yMax = Math.min(maxDim - 1, y + kernelSize);
        const xMin = Math.max(0, x - kernelSize);
        const xMax = Math.min(maxDim - 1, x + kernelSize);
        
        for (let ny = yMin; ny <= yMax; ny++) {
          for (let nx = xMin; nx <= xMax; nx++) {
            if (square[ny][nx] > 0) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) break;
        }
        
        thickened[y][x] = hasContent ? 255 : 0;
      }
    }
  
    // Step 4: Resize to 28x28 using optimized area sampling
    const resized = new Array(28);
    for (let i = 0; i < 28; i++) {
      resized[i] = new Array(28).fill(0);
    }
    
    const scale = maxDim / 28;
    
    for (let y = 0; y < 28; y++) {
      const sourceYStart = Math.floor(y * scale);
      const sourceYEnd = Math.min(maxDim - 1, Math.floor((y + 1) * scale - 1));
      
      for (let x = 0; x < 28; x++) {
        const sourceXStart = Math.floor(x * scale);
        const sourceXEnd = Math.min(maxDim - 1, Math.floor((x + 1) * scale - 1));
        
        let sum = 0;
        let count = 0;
        
        // Optimized area sampling with early termination
        for (let sy = sourceYStart; sy <= sourceYEnd; sy++) {
          for (let sx = sourceXStart; sx <= sourceXEnd; sx++) {
            sum += thickened[sy][sx];
            count++;
            
            // Early termination if we've already found enough white pixels
            if (sum > count * 127) {
              // We'll definitely exceed the threshold, no need to check more pixels
              resized[y][x] = 255;
              sy = sourceYEnd + 1; // Break outer loop
              break;
            }
          }
        }
        
        // Only calculate average if we haven't already set the value
        if (resized[y][x] === 0 && count > 0) {
          resized[y][x] = (sum / count) > 127 ? 255 : 0;
        }
      }
    }
  
    // Step 5: Output to console
    console.log(resized);
    this.current_pixel_val += 1;
    if(this.current_pixel_val > 10)
    {
      this.current_pixel_val = 0;
    }
  }


  
  // Function to draw a bounding box based on corner coordinates
  private drawBoundingBox(): void {
    const container = this.el.nativeElement.querySelector('.starry-background');
    
    // Remove previous bounding box if it exists
    this.removeBoundingBox();
    
    // Create a container element for the bounding box elements
    this.boundingBoxContainer = document.createElement('div');
    this.boundingBoxContainer.classList.add('bounding-box-container');
    this.boundingBoxContainer.style.position = 'absolute';
    this.boundingBoxContainer.style.pointerEvents = 'none';
    this.boundingBoxContainer.style.zIndex = '1001';
    
    container.appendChild(this.boundingBoxContainer);
    
    // Draw top line
    this.createBoxLine(
      this.topLeft.col, 
      this.topLeft.row, 
      this.topRight.col, 
      this.topRight.row
    );
    
    // Draw right line
    this.createBoxLine(
      this.topRight.col, 
      this.topRight.row, 
      this.bottomRight.col, 
      this.bottomRight.row
    );
    
    // Draw bottom line
    this.createBoxLine(
      this.bottomRight.col, 
      this.bottomRight.row, 
      this.bottomLeft.col, 
      this.bottomLeft.row
    );
    
    // Draw left line
    this.createBoxLine(
      this.bottomLeft.col, 
      this.bottomLeft.row, 
      this.topLeft.col, 
      this.topLeft.row
    );
  }

  // Helper function to create a line for the bounding box
  private createBoxLine(fromX: number, fromY: number, toX: number, toY: number): void {
    if (!this.boundingBoxContainer) return;
    
    // Calculate line properties
    const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    // Create line element
    const line = document.createElement('div');
    line.style.position = 'absolute';
    line.style.left = `${fromX}px`;
    line.style.top = `${fromY}px`;
    line.style.width = `${length}px`;
    line.style.height = '3px'; // Slightly thicker than drawing lines
    line.style.backgroundColor = '#ffffff';
    line.style.opacity = '1';
    line.style.transformOrigin = '0 0';
    line.style.transform = `rotate(${angle}rad)`;
    line.style.boxShadow = '0 0 10px #ffffff, 0 0 20px #aaaaff';
    line.style.pointerEvents = 'none';
    
    this.boundingBoxContainer.appendChild(line);
  }

  // Function to remove the previously drawn bounding box
  private removeBoundingBox(): void {
    if (this.boundingBoxContainer) {
      this.boundingBoxContainer.remove();
      this.boundingBoxContainer = null;
    }
  }

  private getBoundingBoxCorners(): void {
    const height = this.drawingRecorder.length;
    const width = this.drawingRecorder[0].length;
    // Initialize min/max coordinates to find the bounding box
    let minRow = height;
    let maxRow = 0;
    let minCol = width;
    let maxCol = 0;
    
    // Find the boundaries of non-zero elements
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (this.drawingRecorder[row][col] !== 0) {
          minRow = Math.min(minRow, row);
          maxRow = Math.max(maxRow, row);
          minCol = Math.min(minCol, col);
          maxCol = Math.max(maxCol, col);
        }
      }
    }
    
    // If no non-zero elements were found, return null or an indicator
    if (minRow > maxRow || minCol > maxCol) {
      
    }
    else
    {
      this.topLeft.row = minRow;
      this.topLeft.col = minCol;
      this.topRight.row = minRow;
      this.topRight.col = maxCol;
      this.bottomLeft.row = maxRow;
      this.bottomLeft.col = minCol;
      this.bottomRight.row = maxRow;
      this.bottomRight.col = maxCol;
    }
  }

  private initializeDrawingRecorder(): void {
    // Get the container dimensions
    this.canvasWidth = window.innerWidth;
    this.canvasHeight = window.innerHeight;
    
    // Initialize the 2D array with zeros
    this.resetDrawingRecorder();
  }

  private resetDrawingRecorder(): void {
    // Create a new 2D array filled with zeros
    this.drawingRecorder = Array(this.canvasHeight).fill(0).map(() => Array(this.canvasWidth).fill(0));
  }

  private recordDrawingPoint(x: number, y: number): void {
    // Ensure coordinates are within bounds
    x = Math.floor(x);
    y = Math.floor(y);
    
    if (x >= 0 && x < this.canvasWidth && y >= 0 && y < this.canvasHeight) {
      // Record the point as 255 (white)
      this.drawingRecorder[y][x] = 255;
      
      // Also record neighboring pixels with decreasing intensity to create a smoother effect
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < this.canvasWidth && ny >= 0 && ny < this.canvasHeight) {
            // Calculate distance from center point
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Calculate intensity based on distance (255 at center, decreasing outward)
            const intensity = Math.max(0, Math.min(255, Math.floor(255 * (1 - distance/3))));
            
            // Only set if the new intensity is higher than what's already there
            if (intensity > this.drawingRecorder[ny][nx]) {
              this.drawingRecorder[ny][nx] = intensity;
            }
          }
        }
      }
    }
  }

  private recordDrawingLine(fromX: number, fromY: number, toX: number, toY: number): void {
    // Use Bresenham's line algorithm to interpolate points between fromX,fromY and toX,toY
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);
    const sx = fromX < toX ? 1 : -1;
    const sy = fromY < toY ? 1 : -1;
    let err = dx - dy;
    
    let x = fromX;
    let y = fromY;
    
    while (true) {
      // Record this point
      this.recordDrawingPoint(x, y);
      
      if (x === toX && y === toY) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  private startRecording(): void {
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
    }
    
    // Reset the recording array
    this.resetDrawingRecorder();
    
    // Start recording
    this.isRecording = true;
    
    // Remove any existing bounding box when starting a new recording
    //this.removeBoundingBox();
    
    // Set a timeout to stop recording after 2 seconds
    this.recordingTimeout = setTimeout(() => {
      this.isRecording = false;
      console.log('Recording completed. Array contains drawing data.');
      
      // Calculate the bounding box corners from the drawing recorder
      this.getBoundingBoxCorners();

      this.getMnistInputArray();
      
      // Draw the bounding box
      //this.drawBoundingBox();
      
    }, this.recordingDuration);
  }

  private generateStars(): void {
    const container = this.el.nativeElement.querySelector('.starry-background');
    
    // Create stars
    for (let i = 0; i < 200; i++) {
      const star = document.createElement('div');
      
      // Make about 60% of stars twinkle
      const isTwinkle = Math.random() > 0.4;
      
      // Set styles programmatically
      star.style.position = 'absolute';
      star.style.backgroundColor = '#ffffff';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.imageRendering = 'pixelated';
      
      // Randomize animation delay
      star.style.animationDelay = `${Math.random() * 5}s`;
      
      // Randomize star size (1-4px)
      const size = 1 + Math.floor(Math.random() * 4);
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      
      if (isTwinkle) {
        star.style.animation = 'twinkle 3s infinite alternate';
      }
      
      container.appendChild(star);
      this.stars.push(star);
    }
  }

  private createShootingStars(): void {
    const container = this.el.nativeElement.querySelector('.starry-background');
    
    // Remove old shooting stars
    this.shootingStars.forEach(star => {
      star.remove();
    });
    this.shootingStars = [];
    
    // Create new shooting stars
    const numberOfShootingStars = 2 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numberOfShootingStars; i++) {
      // Choose a random character from our pixel font
      const pixelMatrix = this.pixelCharacters[this.current_pixel_val];
      
      // Create a container for the character and its trail
      const shootingStarContainer = document.createElement('div');
      shootingStarContainer.style.position = 'absolute';
      shootingStarContainer.style.left = `${Math.random() * 60}%`;
      shootingStarContainer.style.top = `${Math.random() * 30}%`;
      shootingStarContainer.style.zIndex = '1';
      shootingStarContainer.style.transformOrigin = 'center';
      
      // Set the animation
      const delay = Math.random() * 3;
      shootingStarContainer.style.animationDelay = `${delay}s`;
      
      const duration = 2 + Math.random() * 3;
      shootingStarContainer.style.animation = `shoot ${duration}s linear forwards`;
      
      // Create the pixel character
      const characterSize = 3; // Size of each pixel in px
      const characterWidth = pixelMatrix[0].length * characterSize;
      const characterHeight = pixelMatrix.length * characterSize;
      
      // Create the character pixels
      for (let row = 0; row < pixelMatrix.length; row++) {
        for (let col = 0; col < pixelMatrix[row].length; col++) {
          if (pixelMatrix[row][col] === 1) {
            const pixel = document.createElement('div');
            pixel.style.position = 'absolute';
            pixel.style.left = `${col * characterSize}px`;
            pixel.style.top = `${row * characterSize}px`;
            pixel.style.width = `${characterSize}px`;
            pixel.style.height = `${characterSize}px`;
            pixel.style.backgroundColor = '#ffffff';
            pixel.style.boxShadow = '0 0 4px #ffffff, 0 0 8px #aaaaff';
            shootingStarContainer.appendChild(pixel);
          }
        }
      }
      
      // Create trail effect behind the character
      const trail = document.createElement('div');
      trail.style.position = 'absolute';
      trail.style.width = '30px'; // Length of trail
      trail.style.height = '2px';
      
      // Calculate angle and position for the trail based on the shooting direction
      // The direction is from top-left to bottom-right (as per your animation)
      const angle = Math.atan2(1, 1); // 45 degrees, matching your shoot animation
      trail.style.transformOrigin = '0 0'; // Origin at the left edge
      trail.style.clipPath = 'polygon(0% 0%, 100% 50%, 0% 100%)';
      trail.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI}rad) scaleX(2)`;

      // Gradient direction
      trail.style.background = 'linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(170,170,255,0.8) 50%, rgba(255,255,255,0) 100%)';
      trail.style.boxShadow = '0 0 8px rgba(255,255,255,0.6)';
      const centerX = characterWidth / 2;
      const centerY = characterHeight / 2;
      const offsetX = 10; // Negative value shifts left
      trail.style.left = `${centerX + offsetX}px`;
      trail.style.top = `${centerY}px`;
      
      shootingStarContainer.appendChild(trail);
      
      container.appendChild(shootingStarContainer);
      this.shootingStars.push(shootingStarContainer);
    }
  }

  private createCustomCursor(): void {
    const container = this.el.nativeElement.querySelector('.starry-background');
    
    // Create custom cursor
    this.customCursor = document.createElement('div');
    this.customCursor.style.position = 'absolute';
    this.customCursor.style.width = '8px';
    this.customCursor.style.height = '8px';
    this.customCursor.style.borderRadius = '50%';
    this.customCursor.style.backgroundColor = '#ffffff';
    this.customCursor.style.boxShadow = '0 0 10px #ffffff, 0 0 20px #aaaaff';
    this.customCursor.style.pointerEvents = 'none';
    this.customCursor.style.zIndex = '1000';
    this.customCursor.style.transform = 'translate(-50%, -50%)';
    
    container.appendChild(this.customCursor);
  }

  private updateSparkles(): void {
    const container = this.el.nativeElement.querySelector('.starry-background');
    
    // Clean up old sparkles
    this.sparkles.forEach((sparkle, index) => {
      if (parseInt(sparkle.style.opacity) <= 0.1) {
        sparkle.remove();
        this.sparkles.splice(index, 1);
      } else {
        sparkle.style.opacity = (parseFloat(sparkle.style.opacity) - 0.05).toString();
      }
    });
    
    // Add new sparkle at cursor position
    if (this.mouseX > 0 && this.mouseY > 0) {
      const sparkle = document.createElement('div');
      
      sparkle.style.position = 'absolute';
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

  private getRandomSparkleColor(): string {
    const colors = ['#ffffff', '#aaaaff', '#ffaaaa', '#ffffaa', '#aaffaa', '#ffaaff'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private createDrawingLine(fromX: number, fromY: number, toX: number, toY: number): void {
    const container = this.el.nativeElement.querySelector('.starry-background');
    
    // Calculate line properties
    const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    // Create line element
    const line = document.createElement('div');
    line.style.position = 'absolute';
    line.style.left = `${fromX}px`;
    line.style.top = `${fromY}px`;
    line.style.width = `${length}px`;
    line.style.height = '2px';
    line.style.backgroundColor = '#ffffff';
    line.style.opacity = '0.8';
    line.style.transformOrigin = '0 0';
    line.style.transform = `rotate(${angle}rad)`;
    line.style.boxShadow = '0 0 8px #ffffff, 0 0 12px #aaaaff';
    line.style.zIndex = '998';
    line.style.pointerEvents = 'none';
    line.style.transition = 'opacity 1.5s';
    
    container.appendChild(line);
    this.drawingLines.push(line);
    
    // Record this line in our drawing array if we're recording
    if (this.isRecording) {
      this.recordDrawingLine(fromX, fromY, toX, toY);
    }
    
    // Fade out the line after a delay
    setTimeout(() => {
      line.style.opacity = '0';
      
      // Remove the line after fade completes
      setTimeout(() => {
        line.remove();
        const index = this.drawingLines.indexOf(line);
        if (index !== -1) {
          this.drawingLines.splice(index, 1);
        }
      }, 1500);
    }, 500);
  }

  private createAnimationStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes twinkle {
        0% {
          opacity: 0.2;
          background-color: #aaaaff;
        }
        50% {
          opacity: 1;
          background-color: #ffffff;
        }
        100% {
          opacity: 0.5;
          background-color: #aaaaff;
        }
      }
      
      @keyframes shoot {
        0% {
          transform: translateX(0) translateY(0);
          opacity: 1;
        }
        70% {
          opacity: 1;
        }
        100% {
          transform: translateX(300px) translateY(300px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isBrowser) return;
    
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;
    
    // Update custom cursor position
    if (this.customCursor) {
      this.customCursor.style.left = `${this.mouseX}px`;
      this.customCursor.style.top = `${this.mouseY}px`;
    }
    
    // Draw line if currently drawing
    if (this.isDrawing && this.lastX !== 0 && this.lastY !== 0) {
      this.createDrawingLine(this.lastX, this.lastY, this.mouseX, this.mouseY);
    }
    
    this.lastX = this.mouseX;
    this.lastY = this.mouseY;
  }

  @HostListener('mousedown')
  onMouseDown(): void {
    if (!this.isBrowser) return;
    
    this.isDrawing = true;
    
    // Start a new recording when drawing begins
    this.startRecording();
  }

  @HostListener('mouseup')
  onMouseUp(): void {
    if (!this.isBrowser) return;
    
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (!this.isBrowser) return;
    
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
  }
  
  @HostListener('window:resize')
  onResize(): void {
    if (!this.isBrowser) return;
    
    // Update the dimensions when the window is resized
    this.canvasWidth = window.innerWidth;
    this.canvasHeight = window.innerHeight;
    this.resetDrawingRecorder();
  }
}