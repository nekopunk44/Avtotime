import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Move, ZoomIn, ZoomOut, RotateCw, Download, X } from 'lucide-react';

const ImageEditor = ({ imageUrl, onImageEdited, onClose, aspectRatio = 16/9 }) => {
  const [cropData, setCropData] = useState({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
      const container = containerRef.current;
      if (container) {
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const scale = Math.min(
          containerWidth / img.width,
          containerHeight / img.height,
          1
        );
        setCropData(prev => ({ ...prev, scale }));
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    
    if (!canvas || !ctx || !img) return;

    const container = containerRef.current;
    if (!container) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((cropData.rotation * Math.PI) / 180);
    ctx.scale(cropData.scale, cropData.scale);
    ctx.translate(-canvas.width / 2 + cropData.x, -canvas.height / 2 + cropData.y);
    
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    const canvasAspect = canvas.width / canvas.height;
    const imgAspect = imgWidth / imgHeight;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    if (imgAspect > canvasAspect) {
      drawHeight = canvas.height;
      drawWidth = drawHeight * imgAspect;
      drawX = (canvas.width - drawWidth) / 2;
      drawY = 0;
    } else {
      drawWidth = canvas.width;
      drawHeight = drawWidth / imgAspect;
      drawX = 0;
      drawY = (canvas.height - drawHeight) / 2;
    }
    
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    
    ctx.restore();
    
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }, [cropData, imageSize]);

  useEffect(() => {
    drawImage();
  }, [drawImage]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropData.x, y: e.clientY - cropData.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    setCropData(prev => ({
      ...prev,
      x: newX,
      y: newY
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setCropData(prev => ({
      ...prev,
      scale: Math.min(prev.scale * 1.1, 3)
    }));
  };

  const handleZoomOut = () => {
    setCropData(prev => ({
      ...prev,
      scale: Math.max(prev.scale / 1.1, 0.5)
    }));
  };

  const handleRotate = () => {
    setCropData(prev => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360
    }));
  };

  const handleReset = () => {
    setCropData({
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0
    });
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) return;
    
    const container = containerRef.current;
    if (container) {
      tempCanvas.width = container.clientWidth;
      tempCanvas.height = container.clientHeight;
      
      tempCtx.drawImage(canvas, 0, 0);
      
      tempCanvas.toBlob((blob) => {
        if (blob) {
          const editedUrl = URL.createObjectURL(blob);
          onImageEdited(editedUrl, cropData);
        }
      }, 'image/jpeg', 0.9);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Edit Photo</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div 
            ref={containerRef}
            className="relative bg-gray-100 rounded-lg overflow-hidden cursor-move"
            style={{ height: '400px' }}
          >
            <canvas
              ref={canvasRef}
              width={600}
              height={400}
              className="w-full h-full"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Edit"
              className="hidden"
              crossOrigin="anonymous"
            />
          </div>

          <div className="flex items-center justify-center gap-2 mt-4 p-4 bg-gray-50 rounded-lg">
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-white rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round(cropData.scale * 100)}%
            </span>
            
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-white rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            
            <div className="w-px h-6 bg-gray-300 mx-2" />
            
            <button
              onClick={handleRotate}
              className="p-2 hover:bg-white rounded-lg transition-colors"
              title="Rotate"
            >
              <RotateCw className="w-5 h-5" />
            </button>
            
            <div className="w-px h-6 bg-gray-300 mx-2" />
            
            <button
              onClick={handleReset}
              className="px-3 py-2 text-sm hover:bg-white rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Tips:</strong> Drag to move image, use zoom controls to resize, rotate to adjust orientation
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
