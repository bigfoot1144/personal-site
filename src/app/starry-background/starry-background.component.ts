import { Component, OnInit, OnDestroy, ElementRef, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = 'onnxruntime/';

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
  private drawingLines: HTMLElement[] = [];
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private mouseX = 0;
  private mouseY = 0;
  private current_pixel_val = 10;
  private session: ort.InferenceSession | null = null;

  // star config!
  // -------------------------------
  private readonly MIN_SHOOTING_STARS: number = 3;
  private readonly MAX_SHOOTING_STARS: number = 10;

  // For shootingStarContainer.style.top = `${-(Math.random() * RANDOM_NEGATIVE + BASE_NEGATIVE)}%`;
  // Original: -(Math.random() * 5 + 5)%  => results in a range like -5% to -10%
  private readonly SHOOTING_STAR_TOP_OFFSET_BASE_NEGATIVE_PERCENT: number = 5;
  private readonly SHOOTING_STAR_TOP_OFFSET_RANDOM_NEGATIVE_PERCENT: number = 2;

  // For shootingStarContainer.style.left = `${Math.random() * RANDOM_RANGE + BASE_OFFSET}%`;
  // Original: Math.random() * 100 - 20 => results in a range like -20% to 80%
  private readonly SHOOTING_STAR_LEFT_OFFSET_BASE_PERCENT: number = -20;
  private readonly SHOOTING_STAR_LEFT_OFFSET_RANDOM_RANGE_PERCENT: number = 120;

  private readonly SHOOTING_STAR_MAX_ANIMATION_DELAY_S: number = 40; // Max random delay before animation starts
  private readonly SHOOTING_STAR_BASE_ANIMATION_DURATION_S: number = 2; // Base duration for animation
  private readonly SHOOTING_STAR_RANDOM_ANIMATION_DURATION_S: number = 10; // Random additional duration
  private readonly SHOOTING_STAR_ANIMATION_NAME: string = 'shoot'; // CSS animation name

  private readonly PIXEL_CHARACTER_SIZE_PX: number = 3; // Size of each pixel in the star character
  private readonly PIXEL_BACKGROUND_COLOR: string = '#ffffff'; // Color of the star's pixels

  // Assumed movement vector for calculating trail angle (e.g., Math.atan2(Y, X))
  private readonly TRAIL_ASSUMED_MOVEMENT_VECTOR_Y: number = 1;
  private readonly TRAIL_ASSUMED_MOVEMENT_VECTOR_X: number = 1;
  private shootingStarIntervalMs = 5000;
  
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
  private resized: number[][] = [];
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
      this.shootingStarInterval = setInterval(() => this.createShootingStars(), this.shootingStarIntervalMs);
      
      // Create styles for animations
      this.createAnimationStyles();
      
      // Initialize the drawing recorder
      this.initializeDrawingRecorder();
    }
    await this.loadModel();
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      if (this.shootingStarInterval) {
        clearInterval(this.shootingStarInterval);
      }
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
      }
    }
  }

  private async loadModel() {
    try {
      ort.env.wasm.wasmPaths = "/onnxruntime/"
      this.session = await ort.InferenceSession.create('assets/mnist-12-int8.onnx');
      console.log('Model loaded successfully');
    } catch (error) {
      console.error('Error loading model:', error);
    }
  }

  public restartShootingStarEffect(): void {
    if (this.shootingStarInterval) {
      clearInterval(this.shootingStarInterval);
    }
    this.createShootingStars();

    this.shootingStarInterval = setInterval(() => {
      this.createShootingStars();
    }, this.shootingStarIntervalMs);
  }
  
  private getMnistInputArray(lineThickness = 1): void {
    // Ensure drawingRecorder has valid data before proceeding
    if (!this.drawingRecorder || this.drawingRecorder.length === 0 || !this.drawingRecorder[0] || this.drawingRecorder[0].length === 0) {
        console.error("Drawing data is not available.");
        this.resized = []; // Clear or set to default empty state
        return;
    }

    // Step 1: Extract bounding box coordinates with padding
    let minRow = this.topLeft.row;
    let maxRow = this.bottomLeft.row; // Assuming bottomLeft defines max row extent
    let minCol = this.topLeft.col;    // Assuming topLeft defines min col extent
    let maxCol = this.topRight.col;   // Assuming topRight defines max col extent

    // Basic validation for coordinates
      if (minRow > maxRow || minCol > maxCol) {
          console.warn("Invalid bounding box coordinates detected.");
          // You might want to calculate the actual min/max from drawingRecorder if points aren't guaranteed
          // For now, let's just return or handle as an error state
          this.resized = [];
          return;
      }

    // Calculate bounding box dimensions
    const bboxHeight = maxRow - minRow + 1;
    const bboxWidth = maxCol - minCol + 1;

    // Calculate padding (20% of the bounding box size)
    const paddingVertical = Math.ceil(bboxHeight * 0.2);
    const paddingHorizontal = Math.ceil(bboxWidth * 0.2);

    // Apply padding to the bounding box (with boundary checks against drawingRecorder dimensions)
    const sourceHeight = this.drawingRecorder.length;
    const sourceWidth = this.drawingRecorder[0].length;
    minRow = Math.max(0, minRow - paddingVertical);
    maxRow = Math.min(sourceHeight - 1, maxRow + paddingVertical);
    minCol = Math.max(0, minCol - paddingHorizontal);
    maxCol = Math.min(sourceWidth - 1, maxCol + paddingHorizontal);

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
      // Ensure the row exists in the source data
      if (r < 0 || r >= sourceHeight) continue;
      for (let c = minCol; c <= maxCol; c++) {
          // Ensure the column exists in the source data
          if (c < 0 || c >= sourceWidth) continue;

          const targetRow = r - minRow + offsetRow;
          const targetCol = c - minCol + offsetCol;

          // Ensure target indices are within the 'square' bounds
          if (targetRow >= 0 && targetRow < maxDim && targetCol >= 0 && targetCol < maxDim) {
              square[targetRow][targetCol] = this.drawingRecorder[r][c] > 0 ? 255 : 0; // Assuming input is 0/1, output 0/255
          }
      }
    }


    // Step 3: Thicken the lines with configurable thickness
    // Calculate kernel size based on input parameter and scale
    const baseKernelSize = Math.max(1, Math.floor(maxDim / 112)); // Base thickness
    const kernelSize = Math.max(1, Math.round(baseKernelSize * lineThickness)); // Effective radius

    const thickened = new Array(maxDim);
    for (let i = 0; i < maxDim; i++) {
        thickened[i] = new Array(maxDim).fill(0);
    }

    // Simple dilation logic
    for (let y = 0; y < maxDim; y++) {
        for (let x = 0; x < maxDim; x++) {
            // If the pixel in the original square is set, the thickened one definitely is
            if (square[y][x] > 0) {
                thickened[y][x] = 255;
                continue; // Skip neighborhood check if already white
            }

            // Check neighborhood in 'square' array for any white pixel
            let foundNeighbor = false;
            const yStart = Math.max(0, y - kernelSize);
            const yEnd = Math.min(maxDim - 1, y + kernelSize);
            const xStart = Math.max(0, x - kernelSize);
            const xEnd = Math.min(maxDim - 1, x + kernelSize);

            for (let ny = yStart; ny <= yEnd; ny++) {
                for (let nx = xStart; nx <= xEnd; nx++) {
                    if (square[ny][nx] > 0) {
                        thickened[y][x] = 255; // Set current pixel in thickened if neighbor found
                        foundNeighbor = true;
                        break; // Break inner loop
                    }
                }
                if (foundNeighbor) break; // Break outer loop
            }
        }
    }


    // Step 4: Resize to 28x28 using optimized area sampling (from 'thickened' array)
    const finalResizedOutput = new Array(28); // Use a distinct local variable name
    for (let i = 0; i < 28; i++) {
      finalResizedOutput[i] = new Array(28).fill(0);
    }

    const scale = maxDim / 28;

    for (let y = 0; y < 28; y++) {
      const sourceYStart = Math.floor(y * scale);
      // Correct end calculation: should go up to *next* pixel's start, minus epsilon, then floor/ceil.
      // Simpler: map the *center* of the target pixel back to the source range.
      // Or use the average of all source pixels that overlap the target pixel.
      // The provided logic samples a block. Let's refine the end slightly.
      const sourceYEnd = Math.min(maxDim, Math.ceil((y + 1) * scale)); // Use ceil for end, maxDim exclusive bound

      for (let x = 0; x < 28; x++) {
        const sourceXStart = Math.floor(x * scale);
        const sourceXEnd = Math.min(maxDim, Math.ceil((x + 1) * scale)); // Use ceil for end, maxDim exclusive bound

        let sum = 0;
        let count = 0;

        for (let sy = sourceYStart; sy < sourceYEnd; sy++) { // Iterate up to (but not including) sourceYEnd
          // Ensure source row is valid
          if (sy < 0 || sy >= maxDim) continue;
          for (let sx = sourceXStart; sx < sourceXEnd; sx++) { // Iterate up to (but not including) sourceXEnd
              // Ensure source col is valid
              if (sx < 0 || sx >= maxDim) continue;
              sum += thickened[sy][sx]; // Sample from the 'thickened' array
              count++;
          }
        }

        // Calculate average and set pixel value (0 or 255)
        if (count > 0) {
            // Using > 0 instead of > 127 makes it sensitive to any white pixel in the area
            // If you want average intensity, use: (sum / count) > threshold (e.g., 127)
            finalResizedOutput[y][x] = (sum / count) > 1 ? 255 : 0; // Threshold slightly above 0 to catch any white
        } else {
            finalResizedOutput[y][x] = 0; // No source pixels mapped? Default to black.
        }
      }
    }

    // Step 5: Assign the result to the class member variable
    this.resized = finalResizedOutput; // <-- Assignment happens here

    // Optional: Log if needed for debugging
    console.log("Processed MNIST input saved to this.resized"); // You can log this.resized if you want to see it
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

  private async runInference(){ // Added Promise<void> for async
    // --- 1. Check if session and input are ready ---
    if (!this.session) {
      console.error("Inference session not initialized yet.");
      return;
    }
    if (!this.resized || this.resized.length !== 28 || !this.resized[0] || this.resized[0].length !== 28) {
      console.error("Invalid input array prvided for inference.");
      return;
    }
  
    try {
      // --- 2. Get Model Input/Output Names ---
      // IMPORTANT: Replace 'Input3' and 'Plus214_Output_0' with the actual names
      //            logged from `this.session.inputNames[0]` and `this.session.outputNames[0]`
      //            after loading your specific model.
      const inputName = this.session.inputNames[0];
      const outputName = this.session.outputNames[0];
      // console.log(`Using Input: ${inputName}, Output: ${outputName}`); // Uncomment for debugging
  
      // --- 3. Prepare Input Tensor ---
      const height = 28;
      const width = 28;
      const channels = 1; // Grayscale for MNIST
      const batchSize = 1;
      const expectedInputShape = [batchSize, channels, height, width]; // Shape: [1, 1, 28, 28]
      const inputSize = batchSize * channels * height * width; // 784
  
      // Flatten the 28x28 array and normalize (IMPORTANT STEP)
      const flattenedData = new Float32Array(inputSize);
      let k = 0;
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          // *** CRITICAL PREPROCESSING ***
          // MNIST models usually expect input normalized to [0, 1] range.
          // Assuming `this.resized` contains values 0 or 255 from your previous function:
          flattenedData[k] = this.resized[i][j];
          // If your model expects a different range (e.g., [-1, 1] or standardization), adjust accordingly!
          k++;
        }
      }
  
      // Create the ONNX Runtime Tensor
      // Assuming 'float32' input type, which is common. Change if your model differs.
      const inputTensor = new ort.Tensor('float32', flattenedData, expectedInputShape);
  
      // --- 4. Prepare Feeds Object ---
      // The key MUST match the model's input name
      const feeds: Record<string, ort.Tensor> = {};
      feeds[inputName] = inputTensor;
  
      // --- 5. Run Inference ---
      // console.log('Running inference...'); // Uncomment for debugging
      const results = await this.session.run(feeds);
      // console.log('Inference completed.'); // Uncomment for debugging
  
      // --- 6. Process Output ---
      const outputTensor = results[outputName]; // Access output tensor by its name
      // Type assertion based on expected output (usually float32 probabilities for MNIST)
      const outputData = outputTensor.data as Float32Array;
      // const outputShape = outputTensor.dims; // e.g., [1, 10]
  
      // console.log('Output Shape:', outputShape); // Uncomment for debugging
      // console.log('Raw Output Data:', outputData); // Uncomment for debugging
  
      // Find the predicted digit (index with the highest score/probability)
      let maxProbability = -Infinity;
      let predictedIndex = -1;
      for (let i = 0; i < outputData.length; i++) {
        if (outputData[i] > maxProbability) {
          maxProbability = outputData[i];
          predictedIndex = i;
        }
      }
  
      console.log(`Predicted Digit: ${predictedIndex}, Probability: ${maxProbability.toFixed(4)}`);

      this.current_pixel_val = predictedIndex;
      this.restartShootingStarEffect();
  
  
    } catch (error) {
      console.error('Error during inference:', error);
      // Consider updating UI to show an error message
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

      this.runInference();
      
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
    if (!container) {
      console.error('Starry background container not found!'); // Kept specific error message inline
      return;
    }

    const minRange = this.MIN_SHOOTING_STARS;
    const maxRange = this.MAX_SHOOTING_STARS;
    const numberOfShootingStars = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;

    for (let i = 0; i < numberOfShootingStars; i++) {
      const pixelMatrix = this.pixelCharacters[this.current_pixel_val];
      const shootingStarContainer = document.createElement('div');
      shootingStarContainer.style.position = 'absolute';

      shootingStarContainer.style.top = `${-(Math.random() * this.SHOOTING_STAR_TOP_OFFSET_RANDOM_NEGATIVE_PERCENT + this.SHOOTING_STAR_TOP_OFFSET_BASE_NEGATIVE_PERCENT)}%`;
      shootingStarContainer.style.left = `${Math.random() * this.SHOOTING_STAR_LEFT_OFFSET_RANDOM_RANGE_PERCENT + this.SHOOTING_STAR_LEFT_OFFSET_BASE_PERCENT}%`;

      shootingStarContainer.style.zIndex = '1'; // Hardcoded: Common default
      shootingStarContainer.style.transformOrigin = 'center'; // Hardcoded: Common default

      const delay = Math.random() * this.SHOOTING_STAR_MAX_ANIMATION_DELAY_S;
      shootingStarContainer.style.animationDelay = `${delay}s`;

      const duration = this.SHOOTING_STAR_BASE_ANIMATION_DURATION_S + Math.random() * this.SHOOTING_STAR_RANDOM_ANIMATION_DURATION_S;
      shootingStarContainer.style.animation = `${this.SHOOTING_STAR_ANIMATION_NAME} ${duration}s linear forwards`; // Hardcoded: "linear forwards" is typical

      shootingStarContainer.addEventListener('animationend', (event) => {
        const endedStar = event.target as HTMLElement;
        if (endedStar && endedStar.parentNode) {
          endedStar.parentNode.removeChild(endedStar);
        }
        this.shootingStars = this.shootingStars.filter(s => s !== endedStar);
      });

      const characterSize = this.PIXEL_CHARACTER_SIZE_PX;
      const characterWidth = pixelMatrix[0].length * characterSize;
      const characterHeight = pixelMatrix.length * characterSize;

      for (let row = 0; row < pixelMatrix.length; row++) {
        for (let col = 0; col < pixelMatrix[row].length; col++) {
          if (pixelMatrix[row][col] === 1) { // Hardcoded: PIXEL_DRAW_INDICATOR (1) is common
            const pixel = document.createElement('div');
            pixel.style.position = 'absolute';
            pixel.style.left = `${col * characterSize}px`;
            pixel.style.top = `${row * characterSize}px`;
            pixel.style.width = `${characterSize}px`;
            pixel.style.height = `${characterSize}px`;
            pixel.style.backgroundColor = this.PIXEL_BACKGROUND_COLOR;
            pixel.style.boxShadow = '0 0 4px #ffffff, 0 0 8px #aaaaff'; // Hardcoded: Specific visual style
            shootingStarContainer.appendChild(pixel);
          }
        }
      }

      const trail = document.createElement('div');
      trail.style.position = 'absolute';
      trail.style.width = '30px'; // Hardcoded: Specific visual style
      trail.style.height = '2px'; // Hardcoded: Specific visual style
      const angle = Math.atan2(this.TRAIL_ASSUMED_MOVEMENT_VECTOR_Y, this.TRAIL_ASSUMED_MOVEMENT_VECTOR_X);
      trail.style.transformOrigin = '0 0'; // Hardcoded: Trail specific transform origin
      trail.style.clipPath = 'polygon(0% 0%, 100% 50%, 0% 100%)'; // Hardcoded: Trail shape
      trail.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI}rad) scaleX(2)`; // Hardcoded: Math.PI for reversal, scaleX for look
      trail.style.background = 'linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(170,170,255,0.8) 50%, rgba(255,255,255,0) 100%)'; // Hardcoded: Specific gradient
      trail.style.boxShadow = '0 0 8px rgba(255,255,255,0.6)'; // Hardcoded: Specific visual style

      const centerX = characterWidth / 2;
      const centerY = characterHeight / 2;
      const offsetX = 10; // Hardcoded: Trail placement adjustment
      trail.style.left = `${centerX + offsetX}px`;
      trail.style.top = `${centerY}px`;
      shootingStarContainer.appendChild(trail);

      container.appendChild(shootingStarContainer);
      this.shootingStars.push(shootingStarContainer);
    }
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
          transform: translateX(800px) translateY(800px);
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