import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../lib/cropUtils';
import { Crop, RotateCw } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageCropperProps {
  imageFile: File;
  onCropSubmit: (croppedImageBase64: string) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageFile, onCropSubmit, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<'crop' | 'rotate'>('crop');

  React.useEffect(() => {
    const reader = new FileReader();
    reader.addEventListener('load', () => setImageSrc(reader.result as string));
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onCropSubmit(croppedImage);
    } catch (e) {
      console.error(e);
      alert('Failed to crop image');
    }
  };

  if (!imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          rotation={rotation}
          zoom={zoom}
          aspect={1}
          onCropChange={mode === 'crop' ? setCrop : () => {}}
          onRotationChange={mode === 'rotate' ? setRotation : undefined}
          onZoomChange={mode === 'crop' ? setZoom : undefined}
          onCropComplete={onCropComplete}
          cropShape="round"
        />
        {mode === 'rotate' && (
          <div className="absolute inset-0 z-10 bg-transparent" />
        )}
      </div>
      <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex flex-col items-center">
        {mode === 'rotate' && (
          <div className="flex gap-4 w-full max-w-sm items-center mb-4">
            <span className="text-xs font-medium text-gray-500 w-8">{rotation}°</span>
            <input
              type="range"
              value={rotation}
              min={0}
              max={360}
              step={1}
              aria-labelledby="Rotation"
              onChange={(e) => setRotation(Number(e.target.value))}
              className="flex-1"
            />
          </div>
        )}
        
        {mode === 'crop' && (
          <div className="flex gap-4 w-full max-w-sm items-center mb-4">
             <p className="text-sm text-gray-500 dark:text-gray-400 self-center w-full text-center">Pinch to zoom, drag to move</p>
          </div>
        )}

        <div className="flex gap-2 w-full max-w-sm justify-between mt-2">
          <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setMode('crop')}
              className={cn("p-2 rounded-lg transition-colors flex items-center justify-center", mode === 'crop' ? "bg-white dark:bg-gray-700 shadow text-indigo-600 dark:text-indigo-400" : "text-gray-500")}
            >
              <Crop className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMode('rotate')}
              className={cn("p-2 rounded-lg transition-colors flex items-center justify-center", mode === 'rotate' ? "bg-white dark:bg-gray-700 shadow text-indigo-600 dark:text-indigo-400" : "text-gray-500")}
            >
              <RotateCw className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCrop}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
