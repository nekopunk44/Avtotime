import React, { useState, useRef } from 'react';
import { Camera, Edit2, X, Upload } from 'lucide-react';
import ImageEditor from './ImageEditor';

const ImageUpload = ({ 
  onImageUpload, 
  initialImage, 
  aspectRatio = 16/9,
  className = ''
}) => {
  const [imageUrl, setImageUrl] = useState(initialImage || null);
  const [showEditor, setShowEditor] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        setTempImageUrl(result);
        setShowEditor(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageEdited = (editedUrl, cropData) => {
    setImageUrl(editedUrl);
    setShowEditor(false);
    setTempImageUrl(null);
    onImageUpload(editedUrl, cropData);
  };

  const handleEditClick = () => {
    if (imageUrl) {
      setTempImageUrl(imageUrl);
      setShowEditor(true);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    onImageUpload('');
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <div className={`relative group ${className}`}>
        {imageUrl ? (
          <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt="Uploaded"
              className="w-full h-full object-cover"
            />
            
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-2">
                <button
                  onClick={handleEditClick}
                  className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                  title="Edit image"
                >
                  <Edit2 className="w-4 h-4 text-gray-700" />
                </button>
                <button
                  onClick={handleRemoveImage}
                  className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                  title="Remove image"
                >
                  <X className="w-4 h-4 text-gray-700" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={handleUploadClick}
            className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-200 transition-colors"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <Upload className="w-12 h-12 mb-2" />
              <span className="text-sm font-medium">Click to upload image</span>
              <span className="text-xs mt-1">or drag and drop</span>
            </div>
            
            <div className="absolute inset-0 bg-blue-600 bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
              <Camera className="w-16 h-16 text-blue-600 opacity-0 hover:opacity-100 transition-opacity duration-200" />
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {showEditor && tempImageUrl && (
        <ImageEditor
          imageUrl={tempImageUrl}
          onImageEdited={handleImageEdited}
          onClose={() => {
            setShowEditor(false);
            setTempImageUrl(null);
          }}
          aspectRatio={aspectRatio}
        />
      )}
    </>
  );
};

export default ImageUpload;
