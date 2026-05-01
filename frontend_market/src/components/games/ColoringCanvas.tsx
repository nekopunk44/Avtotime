import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { motion } from 'framer-motion';

interface ColoringCanvasProps {
  svgContent: string;
  viewBox: string;
  width: number;
  height: number;
  brushColor: string;
  brushSize: number;
  onProgress?: (progress: number) => void;
}

export const ColoringCanvas = forwardRef<{ resetCanvas: () => void }, ColoringCanvasProps>(({
  svgContent,
  viewBox,
  width,
  height,
  brushColor,
  brushSize,
  onProgress,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [coloredPixels, setColoredPixels] = useState(0);
  const totalPixelsRef = useRef(0);
  const imageDataRef = useRef<ImageData | null>(null);

  // Initialize canvas with SVG
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Parse viewBox
    const [vbX, vbY, vbW, vbH] = viewBox.split(' ').map(Number);
    
    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create image from SVG
    const img = new Image();
    img.onload = () => {
      // Draw SVG as outline
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Store initial image data for progress calculation
      imageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      totalPixelsRef.current = canvas.width * canvas.height;
      
      // Convert colored areas to white (for coloring)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Make the outline black and fill areas white
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        
        // If pixel is dark (part of the outline), keep it black
        if (brightness < 128) {
          data[i] = 31;     // R
          data[i + 1] = 41; // G
          data[i + 2] = 55; // B
          data[i + 3] = 255; // A
        } else {
          // Otherwise make it white (colorable area)
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
    };
    
    // Create SVG blob
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
    
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [svgContent, viewBox, width, height]);

  // Drawing functions
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    draw(e);
  }, []);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    
    // Calculate progress
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx || !imageDataRef.current) return;
    
    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const originalData = imageDataRef.current.data;
    
    let coloredCount = 0;
    for (let i = 0; i < currentData.length; i += 4) {
      // Check if pixel color changed from white
      const wasWhite = originalData[i] === 255 && originalData[i + 1] === 255 && originalData[i + 2] === 255;
      const isNowColored = !(currentData[i] === 255 && currentData[i + 1] === 255 && currentData[i + 2] === 255);
      
      if (wasWhite && isNowColored) {
        coloredCount++;
      }
    }
    
    const progress = Math.min(100, Math.round((coloredCount / totalPixelsRef.current) * 100));
    onProgress?.(progress);
  }, [onProgress]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get coordinates
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Draw with brush
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = brushColor;
    ctx.fill();
    
    // Draw connecting line for smooth strokes
    ctx.beginPath();
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = brushColor;
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, brushColor, brushSize]);

  // Reset canvas function
  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw the original SVG
    const img = new Image();
    img.onload = () => {
      // Draw SVG as outline
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Store initial image data for progress calculation
      imageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Convert colored areas to white (for coloring)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Make the outline black and fill areas white
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        
        // If pixel is dark (part of the outline), keep it black
        if (brightness < 128) {
          data[i] = 31;     // R
          data[i + 1] = 41; // G
          data[i + 2] = 55; // B
          data[i + 3] = 255; // A
        } else {
          // Otherwise make it white (colorable area)
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
    };
    
    // Create SVG blob
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, [svgContent]);

  // Expose resetCanvas method via ref
  useImperativeHandle(ref, () => ({
    resetCanvas
  }), [resetCanvas]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        className="rounded-lg shadow-md cursor-crosshair touch-none block"
        style={{ 
          width: 'auto',
          height: 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
    </div>
  );
});

ColoringCanvas.displayName = 'ColoringCanvas';
