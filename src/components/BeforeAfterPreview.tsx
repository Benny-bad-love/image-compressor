'use client';

import { useCompressor } from '@/context/CompressorContext';
import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { formatFileSize } from '@/utils/formatters';
import Image from 'next/image';

// Debug helper - set to false in production
const DEBUG = false;
const debug = (...args: any[]) => {
  if (DEBUG) {
    console.log('[BeforeAfterPreview]', ...args);
  }
};

// Helper function to compare compression settings
const areSettingsEqual = (settings1: any, settings2: any): boolean => {
  if (!settings1 || !settings2) return false;

  return (
    settings1.quality === settings2.quality &&
    settings1.maxWidth === settings2.maxWidth &&
    settings1.maxHeight === settings2.maxHeight &&
    settings1.format === settings2.format &&
    settings1.preserveExif === settings2.preserveExif &&
    settings1.applySharpening === settings2.applySharpening &&
    settings1.sharpeningAmount === settings2.sharpeningAmount &&
    settings1.showSizeControls === settings2.showSizeControls
  );
};

// Memoize the component to prevent unnecessary re-renders
const BeforeAfterPreview = memo(function BeforeAfterPreview() {
  const { images, selectedImage, settings, setSelectedImage } = useCompressor();
  const [sliderPosition, setSliderPosition] = useState(50);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [livePreviewSize, setLivePreviewSize] = useState<number | null>(null);
  const [compressionRatio, setCompressionRatio] = useState<number | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [hasInteracted, setHasInteracted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const previewTimeoutRef = useRef<number | null>(null);

  const selectedImageData = selectedImage
    ? images.find(img => img.id === selectedImage)
    : null;

  // Determine if we should use compressed version or live preview
  const shouldUseLivePreview = selectedImageData?.status === 'compressed' &&
    selectedImageData?.compressionSettings &&
    !areSettingsEqual(settings, selectedImageData.compressionSettings);

  // Setup preview URLs and sizes - memoize calculation
  const displayOriginalUrl = selectedImageData?.url; // Always use the original URL for the 'Original' side
  const displayPreviewUrl = shouldUseLivePreview
    ? livePreviewUrl
    : (selectedImageData?.compressedUrl || livePreviewUrl);
  const displayPreviewSize = shouldUseLivePreview
    ? livePreviewSize
    : (selectedImageData?.compressedSize || livePreviewSize);
  const displayPreviewRatio = shouldUseLivePreview
    ? compressionRatio
    : (selectedImageData?.compressionRatio || compressionRatio);

  // Debug information
  useEffect(() => {
    debug('Component state updated:', {
      imagesLength: images.length,
      selectedImage,
      selectedImageData,
      hasFile: selectedImageData?.file ? 'yes' : 'no',
      livePreview: livePreviewUrl ? 'yes' : 'no',
      compressedUrl: selectedImageData?.compressedUrl ? 'yes' : 'no',
      shouldUseLivePreview,
      settingsChanged: selectedImageData?.compressionSettings ?
        !areSettingsEqual(settings, selectedImageData.compressionSettings) : 'no-compression-settings'
    });
  }, [images, selectedImage, selectedImageData, livePreviewUrl, shouldUseLivePreview]);

  // Try to convert blob URL to data URL for the original image
  useEffect(() => {
    if (!selectedImageData) {
      return;
    }

    // For debugging purposes, always try to convert to data URL
    const url = selectedImageData.url;
    if (!url) {
      return;
    }

    debug('Converting original image URL to data URL:', url.substring(0, 30) + '...');

    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Draw the image to a canvas and get data URL
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          debug('Failed to get canvas context');
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Get data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        debug('Successfully converted to data URL:', dataUrl.substring(0, 30) + '...');
      } catch (e) {
        debug('Error converting to data URL:', e);
      }
    };

    img.onerror = (e) => {
      debug('Failed to load image for conversion:', e);
    };

    img.src = url;
  }, [selectedImageData]);

  // Additional debugging for URL
  useEffect(() => {
    if (!selectedImageData || !selectedImageData.url) return;

    try {
      debug('URL type check:', {
        isBlobUrl: selectedImageData.url.startsWith('blob:'),
        isDataUrl: selectedImageData.url.startsWith('data:'),
        url: selectedImageData.url.substring(0, 30) + '...'
      });

      // Check if the blob URL is still valid
      if (selectedImageData.url.startsWith('blob:')) {
        debug('Testing if blob URL is still valid...');
        // Create an image element to test if the URL loads
        const testImg = document.createElement('img');
        testImg.onload = () => {
          debug('Blob URL loaded successfully in test');
        };
        testImg.onerror = () => {
          debug('Blob URL failed to load in test');
        };
        testImg.src = selectedImageData.url;
      }
    } catch (error) {
      debug('Error checking URL:', error);
    }
  }, [selectedImageData]);

  // Generate live preview when settings change
  useEffect(() => {
    let mounted = true;

    // Clear any existing timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    const generatePreview = async () => {
      // Ensure we have a selected image with a valid source (file or URL)
      if (!selectedImageData || (!selectedImageData.file && !selectedImageData.url)) {
        debug('generatePreview: No selected image data or valid source (file/url)');
        if (mounted) {
            setLivePreviewUrl(null); // Clear any old preview
            setDebugInfo('Select an image or check its source.');
        }
        return;
      }
      if (isGeneratingPreview) {
        debug('generatePreview: Already generating');
        return;
      }

      try {
        setIsGeneratingPreview(true);
        setDebugInfo('Generating preview...');

        // Clean up previous preview URL
        if (livePreviewUrl && livePreviewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(livePreviewUrl);
        }

        // Use original file if available
        if (selectedImageData.file) {
          debug('generatePreview: Using file object');
          // Get image from file
          const fileReader = new FileReader();
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            fileReader.onload = (event) => {
              if (!event.target || typeof event.target.result !== 'string') {
                reject(new Error('Failed to read file'));
                return;
              }

              const image = document.createElement('img');
              image.onload = () => resolve(image);
              image.onerror = () => reject(new Error('Failed to create image from file data URL'));
              image.src = event.target.result;
            };

            fileReader.onerror = () => reject(new Error('FileReader error'));
            fileReader.readAsDataURL(selectedImageData.file!);
          });

          // Draw to canvas with compression settings
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize if needed
          if (settings.showSizeControls && (width > settings.maxWidth || height > settings.maxHeight)) {
            const ratio = Math.min(
              settings.maxWidth / width,
              settings.maxHeight / height
            );
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          canvas.width = width || 300;
          canvas.height = height || 300;

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Failed to get canvas context');

          // Draw and apply effects
          ctx.drawImage(img, 0, 0, width, height);

          if (settings.applySharpening && settings.sharpeningAmount) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = settings.sharpeningAmount;
            ctx.drawImage(img, 0, 0, width, height);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
          }

          // Get data URL and calculate size
          const dataUrl = canvas.toDataURL(`image/${settings.format}`, settings.quality);

          // For size calculation, still need blob
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (newBlob) => {
                if (newBlob) resolve(newBlob);
                else reject(new Error('Failed to create blob for size calculation'));
              },
              `image/${settings.format}`,
              settings.quality
            );
          });

          if (mounted) {
            const previewSize = blob.size;
            const ratio = (selectedImageData.size / previewSize).toFixed(2);

            setLivePreviewUrl(dataUrl);
            setLivePreviewSize(previewSize);
            setCompressionRatio(parseFloat(ratio));
            setDebugInfo('Preview ready!');

            debug('Preview generated from file:', {
              originalSize: selectedImageData.size,
              previewSize,
              ratio
            });
          }
        } else if (selectedImageData.url) {
          // Attempt to use original URL if file isn't available (e.g. from localStorage)
          debug('generatePreview: File object not found, attempting to use original URL:', selectedImageData.url.substring(0,30));
          const img = document.createElement('img');
          img.crossOrigin = 'anonymous';

          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Image load from URL timed out')), 5000);
            img.onload = () => { clearTimeout(timeoutId); resolve(); };
            img.onerror = () => { clearTimeout(timeoutId); reject(new Error('Failed to load image from original URL')); };
            img.src = selectedImageData.url;
          });

          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (settings.showSizeControls && (width > settings.maxWidth || height > settings.maxHeight)) {
            const ratio = Math.min(settings.maxWidth / width, settings.maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          canvas.width = width || 300;
          canvas.height = height || 300;

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Failed to get canvas context (URL path)');

          ctx.drawImage(img, 0, 0, width, height);

          if (settings.applySharpening && settings.sharpeningAmount) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = settings.sharpeningAmount;
            ctx.drawImage(img, 0, 0, width, height);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
          }

          const dataUrl = canvas.toDataURL(`image/${settings.format}`, settings.quality);
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(newBlob => newBlob ? resolve(newBlob) : reject(new Error('Blob creation failed (URL path)')),
              `image/${settings.format}`, settings.quality);
          });

          if (mounted) {
            const previewSize = blob.size;
            const ratio = (selectedImageData.size / previewSize).toFixed(2);
            setLivePreviewUrl(dataUrl);
            setLivePreviewSize(previewSize);
            setCompressionRatio(parseFloat(ratio));
            setDebugInfo('Preview ready (from URL)!');
            debug('Preview generated from URL:', { originalSize: selectedImageData.size, previewSize, ratio });
          }
        } else {
          setDebugInfo('No valid source (file or URL) for preview.');
          if (mounted) setLivePreviewUrl(null);
        }
      } catch (error) {
        debug('Error in generatePreview:', error);
        if (mounted) {
          setDebugInfo(`Error: ${error instanceof Error ? error.message : 'Unknown preview error'}`);
          setLivePreviewUrl(null);
          setLivePreviewSize(null);
          setCompressionRatio(null);
        }
      } finally {
        if (mounted) {
          setIsGeneratingPreview(false);
        }
      }
    };

    // Debounce preview generation
    previewTimeoutRef.current = window.setTimeout(generatePreview, 300);

    return () => {
      mounted = false;
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [selectedImageData, settings]); // Dependency array updated

  // Clean up preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (livePreviewUrl && livePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(livePreviewUrl);
      }
    };
  }, [livePreviewUrl]);

  // Debug DOM to find image loading issues - run this whenever the preview URL changes
  useEffect(() => {
    if (!livePreviewUrl) return;

    // Wait for next render cycle
    const timeoutId = setTimeout(() => {
      try {
        debug('Inspecting DOM for image elements after render');
        const previewImages = document.querySelectorAll('img');

        debug(`Found ${previewImages.length} image elements in DOM`);

        // Check each image to see if its src matches our data URLs
        previewImages.forEach((img, index) => {
          const src = img.getAttribute('src');
          if (!src) {
            debug(`Image ${index}: No src attribute`);
            return;
          }

          const isDataUrl = src.startsWith('data:');
          const isBlobUrl = src.startsWith('blob:');
          const isLocalUrl = !isDataUrl && !isBlobUrl;

          debug(`Image ${index} (${isDataUrl ? 'data' : isBlobUrl ? 'blob' : 'local'} URL): ${src.substring(0, 30)}...`);

          // Check if this is our preview
          if (isDataUrl && src === livePreviewUrl) {
            debug(`Found our preview image at index ${index}`);
          }

          // Check loading state
          debug(`Image ${index} completed: ${img.complete}, naturalWidth: ${img.naturalWidth}`);
        });
      } catch (e) {
        debug('Error inspecting DOM:', e);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [livePreviewUrl]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      // Immediately move slider to click position
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(position);
    }

    isDraggingRef.current = true;
    setHasInteracted(true);

    // Add a class to the body to prevent text selection during dragging
    document.body.classList.add('slider-dragging');
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;

    // Remove the class when dragging ends
    document.body.classList.remove('slider-dragging');
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(position);
    },
    []
  );

  // Set up touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Only prevent default on the slider handle to allow scrolling the page
    // but we still want the immediate positioning behavior

    if (containerRef.current) {
      // Immediately move slider to touch position
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.touches[0].clientX - rect.left));
      const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(position);
    }

    isDraggingRef.current = true;
    setHasInteracted(true);
    document.body.classList.add('slider-dragging');
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Only prevent default on the handle element
    isDraggingRef.current = false;
    document.body.classList.remove('slider-dragging');
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // We still prevent default here to prevent page scrolling while adjusting the slider
    if (isDraggingRef.current) {
      e.preventDefault();

      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.touches[0].clientX - rect.left));
      const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(position);
    }
  }, []);

  // Set up global event listeners
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.classList.remove('slider-dragging');
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleMouseMove(e);
    };

    // Add an event to handle when user leaves the window while dragging
    const handleBlur = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.classList.remove('slider-dragging');
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('blur', handleBlur);
      document.body.classList.remove('slider-dragging');
    };
  }, [handleMouseMove]);

  // Add CSS to handle slider dragging globally
  useEffect(() => {
    // Add style to document head for preventing text selection when dragging
    const style = document.createElement('style');
    style.innerHTML = `
      body.slider-dragging {
        user-select: none;
        cursor: ew-resize !important;
      }
      body.slider-dragging * {
        cursor: ew-resize !important;
      }

      /* Pulse animation for slider handle */
      @keyframes pulse-ring {
        0% {
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
        }
      }

      /* Side-to-side animation to suggest dragging */
      @keyframes suggest-drag {
        0% {
          transform: translateX(-5px);
        }
        50% {
          transform: translateX(5px);
        }
        100% {
          transform: translateX(-5px);
        }
      }

      .pulse-animation {
        animation: pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
      }

      .slider-handle:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.8), 0 0 0 5px rgba(255, 255, 255, 0.5);
      }

      .suggest-drag-animation {
        animation: suggest-drag 2s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);

    return () => {
      // Cleanup style when component unmounts
      document.head.removeChild(style);
    };
  }, []);

  // Add a pulse effect to the slider handle when it first appears
  const [showPulse, setShowPulse] = useState(true);

  // Turn off pulse after a few seconds or when user interacts
  useEffect(() => {
    if (displayPreviewUrl && showPulse) {
      const timer = setTimeout(() => {
        setShowPulse(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [displayPreviewUrl, showPulse]);

  // Turn off pulse animation when user interacts
  useEffect(() => {
    if (hasInteracted && showPulse) {
      setShowPulse(false);
    }
  }, [hasInteracted, showPulse]);

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Only respond to left/right arrow keys
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); // Prevent page scrolling

      // Determine step size - smaller for fine control with Shift held
      const step = e.shiftKey ? 1 : 5;

      // Update position based on key
      setSliderPosition(prev => {
        const newPosition = e.key === 'ArrowLeft'
          ? Math.max(0, prev - step)
          : Math.min(100, prev + step);
        return newPosition;
      });

      // Mark as interacted
      if (!hasInteracted) {
        setHasInteracted(true);
      }
    }
  }, [hasInteracted]);

  // Show a basic preview container even if there are no images
  if (images.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
        <h2 className="text-xl font-semibold mb-4">Before / After Preview</h2>
        <div className="h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded">
          <div className="text-center p-4">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Upload images to start compressing
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main preview component
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6" id="before-after-preview-container">
      <h2 className="text-xl font-semibold mb-2">
        {selectedImageData?.compressedUrl && !shouldUseLivePreview ? 'Before / After Comparison' : 'Live Preview'}
        {isGeneratingPreview && (
          <span className="ml-2 text-sm text-primary-500 animate-pulse">
            (Updating...)
          </span>
        )}
        {shouldUseLivePreview && (
          <span className="ml-2 text-sm text-orange-500">
            (Settings Changed - Live Preview)
          </span>
        )}
      </h2>

      {/* Debug information - only shown when DEBUG is true */}
      {DEBUG && (
        <div className="mb-2 px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">
          <div className="flex justify-between">
            <span className="font-semibold">Status:</span>
            <span className={isGeneratingPreview ? "text-yellow-500" : "text-green-500"}>
              {isGeneratingPreview ? "Generating..." : "Ready"}
            </span>
          </div>
          <div className="truncate text-gray-500 dark:text-gray-400">
            {debugInfo || "No info available"}
          </div>
          {displayPreviewUrl && (
            <div className="truncate text-xs mt-1 text-blue-500">
              Preview URL type: {displayPreviewUrl.substring(0, 5)}...
            </div>
          )}
        </div>
      )}

      {/* Size information */}
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
        <div>
          {selectedImageData && (
            <>Original: {formatFileSize(selectedImageData.size)}</>
          )}
        </div>
        <div>
          {displayPreviewUrl && displayPreviewSize ? (
            <>
              {shouldUseLivePreview ? 'Live Preview' : (selectedImageData?.compressedUrl ? 'Compressed' : 'Preview')}: {formatFileSize(displayPreviewSize)}
              {displayPreviewRatio && (
                <span className="ml-2 text-green-600 dark:text-green-400">
                  ({displayPreviewRatio}x smaller)
                </span>
              )}
            </>
          ) : isGeneratingPreview ? (
            <span className="text-gray-400">Generating preview...</span>
          ) : (
            <span className="text-gray-400">Adjust settings to see preview</span>
          )}
        </div>
      </div>

      {/* Helper text for slider */}
      {displayPreviewUrl && !hasInteracted && (
        <div className="text-center text-sm font-medium text-primary-600 dark:text-primary-400 mb-3 animate-pulse">
          ← Drag the slider or click anywhere to compare images →
        </div>
      )}

      {/* Image preview area with better labeling */}
      <div
        className="relative w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 select-none border border-gray-200 dark:border-gray-600 cursor-ew-resize"
        style={{ height: '60vh' }}
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        role="presentation"
        aria-label="Image comparison container"
      >
        {/* Original Image (Background) */}
        {displayOriginalUrl && (
          <div className="absolute inset-0 w-full h-full">
            <div className="relative w-full h-full">
              <img
                src={displayOriginalUrl}
                alt="Original"
                className="object-contain w-full h-full"
                style={{
                  minWidth: '50px',
                  minHeight: '50px'
                }}
                onError={(e) => {
                  debug('Original image (displayOriginalUrl) failed to load');
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIj5JbWFnZSBMb2FkIEVycm9yPC90ZXh0Pjwvc3ZnPg==';
                }}
              />
            </div>
          </div>
        )}

        {/* Preview with slider */}
        {displayPreviewUrl ? (
          <>
            {/* Compressed/Preview Image (with clip region) */}
            <div
              className="absolute inset-0 h-full overflow-hidden"
              style={{
                width: `${sliderPosition}%`,
                transition: isDraggingRef.current ? 'none' : 'width 0.1s ease-out',
                borderRight: 'solid 1px #fff'
              }}
            >
              <div
                className="relative w-full h-full"
                style={{
                  width: `${(100 / Math.max(0.1, sliderPosition)) * 100}%`
                }}
              >
                <img
                  src={displayPreviewUrl}
                  alt="Compressed Preview"
                  className="object-contain w-full h-full"
                  style={{
                    minWidth: '50px',
                    minHeight: '50px'
                  }}
                  onError={(e) => {
                    debug('Preview image (displayPreviewUrl) failed to load');
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIj5QcmV2aWV3IExvYWQgRXJyb3I8L3RleHQ+PC9zdmc+';
                  }}
                />
              </div>
            </div>

            {/* Slider Line and Handle */}
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-white dark:bg-gray-200 shadow-md z-10"
              style={{
                left: `${sliderPosition}%`,
                transition: isDraggingRef.current ? 'none' : 'left 0.1s ease-out'
              }}
            >
              {/* Vertical line through slider - top half */}
              <div className="absolute top-0 bottom-1/2 w-0.5 bg-primary-500 left-1/2 transform -translate-x-1/2 mb-5"></div>

              {/* Vertical line through slider - bottom half */}
              <div className="absolute top-1/2 bottom-0 w-0.5 bg-primary-500 left-1/2 transform -translate-x-1/2 mt-5"></div>

              {/* Slider handle */}
              <div
                className={`slider-handle absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white dark:bg-gray-200 shadow-lg border border-gray-300 flex items-center justify-center cursor-ew-resize hover:ring-2 hover:ring-primary-500 hover:scale-110 transition-all ${isDraggingRef.current ? 'scale-110 ring-2 ring-primary-500' : ''} ${showPulse && !hasInteracted ? 'pulse-animation' : ''} ${!hasInteracted && !isDraggingRef.current ? 'suggest-drag-animation' : ''}`}
                onMouseDown={(e) => {
                  // Stop propagation to prevent container's click handler
                  e.stopPropagation();
                  // Set dragging state directly since we're not repositioning for handle clicks
                  isDraggingRef.current = true;
                  setHasInteracted(true);
                  document.body.classList.add('slider-dragging');
                }}
                onTouchStart={(e) => {
                  // Prevent default to avoid scrolling when grabbing the handle
                  e.preventDefault();
                  e.stopPropagation();
                  // Set dragging state directly
                  isDraggingRef.current = true;
                  setHasInteracted(true);
                  document.body.classList.add('slider-dragging');
                }}
                onFocus={() => {
                  // Stop animations when focused via keyboard
                  if (!hasInteracted) {
                    setHasInteracted(true);
                  }
                }}
                tabIndex={0}
                role="slider"
                aria-label="Image comparison slider"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(sliderPosition)}
                aria-valuetext={`${Math.round(sliderPosition)}% preview image, ${Math.round(100 - sliderPosition)}% original image`}
                onKeyDown={handleKeyDown}
              >
                <svg
                  className="w-5 h-5 text-gray-600 dark:text-gray-800"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                  />
                </svg>
              </div>
            </div>
          </>
        ) : (
          // Show loading or instructions
          <div className="absolute inset-0 flex items-center justify-center">
            {isGeneratingPreview ? (
              <div className="text-center">
                <svg className="animate-spin h-10 w-10 text-primary-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-500 dark:text-gray-400">
                  {debugInfo || "Generating preview..."}
                </p>
              </div>
            ) : (
              <div className="text-center p-6 max-w-md">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
                  {selectedImageData ? 'Adjust compression settings to see the preview' : 'Select an image to preview'}
                </p>
                {selectedImageData && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Use the controls below to adjust quality, size, and format
                  </p>
                )}

                {/* Show error message if any */}
                {debugInfo && debugInfo.startsWith('Error:') && (
                  <p className="mt-2 text-red-500 dark:text-red-400 text-sm">
                    {debugInfo}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Labels */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs font-bold rounded px-2 py-1 pointer-events-none">
          Original
        </div>
        {displayPreviewUrl && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs font-bold rounded px-2 py-1 pointer-events-none">
            {shouldUseLivePreview ? 'Live Preview' : (selectedImageData?.compressedUrl ? 'Compressed' : 'Live Preview')}
          </div>
        )}
      </div>

      {/* Instructions below the slider */}
      {displayPreviewUrl && (
        <div className="mt-3 text-sm text-center text-gray-600 dark:text-gray-400">
          <p>Drag the slider left/right to compare images</p>
          <p className="text-xs mt-1">Keyboard users: Tab to slider, then use ←/→ arrow keys (hold Shift for fine control)</p>
        </div>
      )}

      {/* Image Selector */}
      {images.length > 1 && (
        <div className="mt-4" id="image-thumbnail-selector-section">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Images
          </label>
          <div className="flex overflow-x-auto space-x-3 pb-2 max-h-12">
            {images.map(image => (
              <div
                key={image.id}
                className={`
                  relative cursor-pointer flex-shrink-0 w-8 h-8 rounded-md overflow-hidden
                  ${selectedImage === image.id ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-gray-800' : 'border border-gray-200 dark:border-gray-600 hover:opacity-90'}
                `}
                onClick={() => setSelectedImage(image.id)}
              >
                {/* Thumbnail */}
                <img
                  src={image.compressedUrl || image.url}
                  alt={image.name}
                  className="object-cover"
                  style={{ maxHeight: '300px' }}
                  onError={(e) => {
                    debug('Thumbnail failed to load');
                    const hash = image.name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                    const hue = hash % 360;
                    (e.target as HTMLImageElement).src = `data:image/svg+xml;base64,${btoa(`<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" fill="hsl(${hue}, 70%, 80%)"/><text x="50%" y="50%" font-family="Arial" font-size="12" fill="hsl(${hue}, 40%, 30%)" text-anchor="middle" alignment-baseline="middle">${image.name.charAt(0)}</text></svg>`)}`;
                  }}
                />

                {/* Selection indicator */}
                {selectedImage === image.id && (
                  <div className="absolute inset-0 bg-primary-500 bg-opacity-20 flex items-center justify-center">
                    <div className="bg-primary-500 rounded-full p-1">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8.736 8.737a1 1 0 01-1.414 0l-3.737-3.737a1 1 0 111.414-1.414L8 13.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Compressed indicator */}
                {image.status === 'compressed' && (
                  <div className="absolute bottom-0 right-0 bg-green-500 rounded-tl-md p-1">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8.736 8.737a1 1 0 01-1.414 0l-3.737-3.737a1 1 0 111.414-1.414L8 13.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// Export the component
export default BeforeAfterPreview;