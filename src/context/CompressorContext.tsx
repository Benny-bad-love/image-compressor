'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CompressorContextType, CompressionSettings, ImageFile } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const defaultSettings: CompressionSettings = {
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1080,
  format: 'jpeg',
  preserveExif: false,
  applySharpening: false,
  sharpeningAmount: 0.5,
  showSizeControls: true,
};

const CompressorContext = createContext<CompressorContextType | null>(null);

export const CompressorProvider = ({ children }: { children: React.ReactNode }) => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [settings, setSettings] = useState<CompressionSettings>(
    () => {
      if (typeof window !== 'undefined') {
        try {
          const savedSettings = localStorage.getItem('compressionSettings');
          if (savedSettings) {
            // Merge saved settings with default settings to ensure all properties exist
            const parsedSettings = JSON.parse(savedSettings);
            return { ...defaultSettings, ...parsedSettings };
          }
        } catch (error) {
          console.error('Error parsing saved settings:', error);
          // If there's an error, fall back to default settings
          return defaultSettings;
        }
      }
      return defaultSettings;
    }
  );

  // Try to restore images from localStorage on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedImagesJson = localStorage.getItem('compressorImages');
        if (savedImagesJson) {
          const savedImages = JSON.parse(savedImagesJson);
          if (Array.isArray(savedImages) && savedImages.length > 0) {
            console.log('Restoring saved images:', savedImages.length);
            setImages(savedImages);
            // Select the first image with a compressed URL, or just the first image
            const firstCompressedImage = savedImages.find(img => img.compressedUrl);
            setSelectedImage(firstCompressedImage?.id || savedImages[0].id);
          }
        }
      } catch (error) {
        console.error('Error restoring saved images:', error);
      }
    }
  }, []);

  // Save settings to local storage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('compressionSettings', JSON.stringify(settings));
    }
  }, [settings]);

  // Save images to local storage when they change
  useEffect(() => {
    if (typeof window !== 'undefined' && images.length > 0) {
      // We can't store File objects in localStorage, so we need to store only the metadata
      const imagesToStore = images.map(img => ({
        id: img.id,
        name: img.name,
        url: img.url,
        size: img.size,
        compressedUrl: img.compressedUrl,
        compressedSize: img.compressedSize,
        compressionRatio: img.compressionRatio,
        status: img.status,
        error: img.error,
      }));

      localStorage.setItem('compressorImages', JSON.stringify(imagesToStore));
    }
  }, [images]);

  // Update selectedImage when images change (e.g., if the selected image is removed)
  useEffect(() => {
    if (selectedImage && !images.some(img => img.id === selectedImage)) {
      setSelectedImage(images.length > 0 ? images[0].id : null);
    } else if (!selectedImage && images.length > 0) {
      // If there's no selected image but we have images, select the first one
      setSelectedImage(images[0].id);
    }
  }, [images, selectedImage]);

  // Add images to the state
  const addImages = useCallback((files: File[]) => {
    const newImages = files.map(file => {
      const url = URL.createObjectURL(file);
      return {
        id: uuidv4(),
        name: file.name,
        file,
        url,
        size: file.size,
        status: 'pending' as const,
      };
    });

    setImages(prev => {
      const updatedImages = [...prev, ...newImages];

      // Set selectedImage to first image if none is selected
      if (!selectedImage && newImages.length > 0) {
        setSelectedImage(newImages[0].id);
      }

      return updatedImages;
    });
  }, [selectedImage]);

  // Remove an image from the state
  const removeImage = useCallback((id: string) => {
    // If removing currently selected image, select another one
    if (selectedImage === id) {
      setImages(prev => {
        const newImages = prev.filter(img => img.id !== id);
        if (newImages.length > 0) {
          setSelectedImage(newImages[0].id);
        } else {
          setSelectedImage(null);
        }

        // If we're removing all images, clear local storage
        if (newImages.length === 0) {
          localStorage.removeItem('compressorImages');
        }

        return newImages;
      });
    } else {
      setImages(prev => {
        const newImages = prev.filter(img => img.id !== id);

        // If we're removing all images, clear local storage
        if (newImages.length === 0) {
          localStorage.removeItem('compressorImages');
        }

        return newImages;
      });
    }
  }, [selectedImage]);

  // Update compression settings
  const updateSettings = useCallback((newSettings: Partial<CompressionSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Compress a single image
  const compressImage = useCallback(async (id: string) => {
    try {
      setImages(prev =>
        prev.map(img =>
          img.id === id ? { ...img, status: 'compressing' } : img
        )
      );

      const image = images.find(img => img.id === id);
      if (!image) throw new Error('Image not found');

      // Create a new image element
      const img = new Image();
      img.src = image.url;

      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Create a canvas element
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Resize image if needed while maintaining aspect ratio
      if (settings.showSizeControls && (width > settings.maxWidth || height > settings.maxHeight)) {
        const ratio = Math.min(
          settings.maxWidth / width,
          settings.maxHeight / height
        );
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw the image on the canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.drawImage(img, 0, 0, width, height);

      // Apply sharpening if enabled
      if (settings.applySharpening && settings.sharpeningAmount) {
        // Simple sharpening effect by drawing the image on top with a different blending mode
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = settings.sharpeningAmount;
        ctx.drawImage(img, 0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

      // Convert canvas to blob
      const mimeType = `image/${settings.format}`;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Error creating blob'));
        }, mimeType, settings.quality);
      });

      // Create URL from the blob
      const compressedUrl = URL.createObjectURL(blob);
      const compressedSize = blob.size;
      const compressionRatio = (image.size / compressedSize).toFixed(2);

      // Update the image in the state
      setImages(prev =>
        prev.map(img =>
          img.id === id ? {
            ...img,
            compressedUrl,
            compressedSize,
            compressionRatio: parseFloat(compressionRatio),
            status: 'compressed'
          } : img
        )
      );

      // Ensure this image is selected after compression
      setSelectedImage(id);
    } catch (error) {
      setImages(prev =>
        prev.map(img =>
          img.id === id ? {
            ...img,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          } : img
        )
      );
    }
  }, [images, settings]);

  // Compress all images
  const compressAllImages = useCallback(async () => {
    const pendingImages = images.filter(img => img.status === 'pending');
    for (const image of pendingImages) {
      await compressImage(image.id);
    }
  }, [images, compressImage]);

  // Download a single compressed image
  const downloadImage = useCallback((id: string) => {
    const image = images.find(img => img.id === id);
    if (!image || !image.compressedUrl) return;

    const a = document.createElement('a');
    a.href = image.compressedUrl;
    a.download = `compressed_${image.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [images]);

  // Download all compressed images
  const downloadAllImages = useCallback(() => {
    const compressedImages = images.filter(img => img.status === 'compressed' && img.compressedUrl);

    compressedImages.forEach(image => {
      downloadImage(image.id);
    });
  }, [images, downloadImage]);

  // Clear all images
  const clearImages = useCallback(() => {
    // Revoke all object URLs to avoid memory leaks
    images.forEach(image => {
      URL.revokeObjectURL(image.url);
      if (image.compressedUrl) URL.revokeObjectURL(image.compressedUrl);
    });

    setImages([]);
    setSelectedImage(null);
    localStorage.removeItem('compressorImages');
  }, [images]);

  return (
    <CompressorContext.Provider
      value={{
        images,
        settings,
        addImages,
        removeImage,
        updateSettings,
        compressImage,
        compressAllImages,
        downloadImage,
        downloadAllImages,
        clearImages,
        selectedImage,
        setSelectedImage,
      }}
    >
      {children}
    </CompressorContext.Provider>
  );
};

export const useCompressor = () => {
  const context = useContext(CompressorContext);
  if (!context) {
    throw new Error('useCompressor must be used within a CompressorProvider');
  }
  return context;
};