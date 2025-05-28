'use client';

import { useCompressor } from '@/context/CompressorContext';
import { useState, useRef, useCallback, useEffect } from 'react';
import { formatFileSize } from '@/utils/formatters';
import Image from 'next/image';

// Debug helper
const DEBUG = true;
const debug = (...args: any[]) => {
  if (DEBUG) {
    console.log('[BeforeAfterPreview]', ...args);
  }
};

export default function BeforeAfterPreview() {
  const { images, selectedImage, settings, setSelectedImage } = useCompressor();
  const [sliderPosition, setSliderPosition] = useState(50);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [livePreviewSize, setLivePreviewSize] = useState<number | null>(null);
  const [compressionRatio, setCompressionRatio] = useState<number | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [originalImageDataUrl, setOriginalImageDataUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const previewTimeoutRef = useRef<number | null>(null);

  const selectedImageData = selectedImage
    ? images.find(img => img.id === selectedImage)
    : null;

  // Debug information
  useEffect(() => {
    debug('Component state updated:', {
      imagesLength: images.length,
      selectedImage,
      selectedImageData,
      hasFile: selectedImageData?.file ? 'yes' : 'no',
      livePreview: livePreviewUrl ? 'yes' : 'no',
      compressedUrl: selectedImageData?.compressedUrl ? 'yes' : 'no'
    });
  }, [images, selectedImage, selectedImageData, livePreviewUrl]);

  // Try to convert blob URL to data URL for the original image
  useEffect(() => {
    if (!selectedImageData) {
      setOriginalImageDataUrl(null);
      return;
    }

    // For debugging purposes, always try to convert to data URL
    const url = selectedImageData.url;
    if (!url) {
      setOriginalImageDataUrl(null);
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
        setOriginalImageDataUrl(dataUrl);
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

  // Generate live preview when settings change or selected image changes
  useEffect(() => {
    if (!selectedImageData || isGeneratingPreview) {
      // Skip preview generation but don't return early
      debug(selectedImageData ? 'Preview generation already in progress' : 'No selected image data');
    } else {
      // Clear any existing timeout to avoid multiple preview generation
      if (previewTimeoutRef.current) {
        debug('Clearing previous timeout');
        clearTimeout(previewTimeoutRef.current);
      }

      debug('Setting up preview generation timeout');
      setDebugInfo('Initializing preview generation...');

      // Debounce preview generation to avoid excessive processing
      previewTimeoutRef.current = window.setTimeout(async () => {
        if (!selectedImageData) return;

        try {
          debug('Starting preview generation');
          setIsGeneratingPreview(true);
          setDebugInfo('Preview generation started');

          // Clean up previous preview URL if it exists
          if (livePreviewUrl) {
            debug('Cleaning up previous preview URL');
            // Only revoke if it's a blob URL, data URLs don't need to be revoked
            if (livePreviewUrl.startsWith('blob:')) {
              URL.revokeObjectURL(livePreviewUrl);
            }
            setLivePreviewUrl(null);
          }

          // Log the details of the selected image for debugging
          debug('Selected Image Data:', {
            id: selectedImageData.id,
            name: selectedImageData.name,
            hasFile: !!selectedImageData.file,
            fileType: selectedImageData.file?.type,
            originalUrlType: selectedImageData.url?.substring(0, 20),
            size: selectedImageData.size,
            compressedUrl: selectedImageData.compressedUrl ? (selectedImageData.compressedUrl.substring(0, 20) + '...') : 'none',
          });

          setDebugInfo('Checking image source...');

          // Try direct file approach first
          const hasFile = !!selectedImageData.file;

          if (!hasFile && !selectedImageData.url) {
            debug('WARNING: Neither file nor URL available for preview generation');
            setDebugInfo('Error: No image source available');
            return;
          }

          debug(`Generating preview from ${hasFile ? 'file' : 'url'}`);
          setDebugInfo(`Loading image from ${hasFile ? 'file' : 'url'}...`);

          let img: HTMLImageElement;

          if (hasFile) {
            debug('Using FileReader for file object');
            try {
              // Use FileReader approach for the actual File object
              const fileReader = new FileReader();
              img = await new Promise((resolve, reject) => {
                fileReader.onload = (event) => {
                  debug('FileReader loaded file successfully');
                  if (!event.target || typeof event.target.result !== 'string') {
                    const error = new Error('Failed to read file');
                    debug('FileReader failed:', error);
                    reject(error);
                    return;
                  }

                  const image = document.createElement('img');
                  image.onload = () => {
                    debug('Image created from FileReader result');
                    resolve(image);
                  };
                  image.onerror = (e) => {
                    const error = new Error('Failed to create image from file');
                    debug('Image creation from file failed:', e);
                    reject(error);
                  };
                  image.src = event.target.result;
                };

                fileReader.onerror = (e) => {
                  const error = new Error('Error reading file');
                  debug('FileReader error:', e);
                  reject(error);
                };

                debug('Starting FileReader.readAsDataURL');
                fileReader.readAsDataURL(selectedImageData.file!);
              });
              debug('Successfully created image from file');
            } catch (error) {
              debug('Error in file reading process:', error);
              setDebugInfo('Error: Failed to read image file');
              throw error;
            }
          } else {
            debug('No file object, trying URL approaches');

            // First try: Simple image loading
            try {
              debug('Approach 1: Direct Image Loading');
              setDebugInfo('Loading image from URL...');

              img = document.createElement('img');
              img.crossOrigin = 'anonymous';

              await new Promise<void>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                  debug('Image load timed out');
                  reject(new Error('Image load timed out'));
                }, 5000);

                img.onload = () => {
                  debug('Image loaded successfully from URL');
                  clearTimeout(timeoutId);
                  resolve();
                };

                img.onerror = (e) => {
                  debug('Image load from URL failed:', e);
                  clearTimeout(timeoutId);
                  reject(new Error('Failed to load image from URL'));
                };

                debug('Setting image.src to:', selectedImageData.url);
                img.src = selectedImageData.url;
              });

              debug('URL approach 1 successful');
            } catch (error) {
              debug('URL approach 1 failed:', error);

              // Second try: Create new empty canvas and render to data URL
              try {
                debug('Approach 2: Creating empty canvas with dimensions');
                setDebugInfo('Creating alternative image source...');

                // Create a colored rectangle as a fallback
                const canvas = document.createElement('canvas');
                canvas.width = 400;  // Default width
                canvas.height = 300; // Default height

                const ctx = canvas.getContext('2d');
                if (ctx) {
                  // Fill with a pattern so it's obviously a fallback
                  ctx.fillStyle = '#f0f0f0';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.fillStyle = '#cccccc';
                  for (let i = 0; i < canvas.width; i += 20) {
                    for (let j = 0; j < canvas.height; j += 20) {
                      if ((i + j) % 40 === 0) {
                        ctx.fillRect(i, j, 20, 20);
                      }
                    }
                  }

                  // Add text explaining the issue
                  ctx.fillStyle = '#666666';
                  ctx.font = '14px Arial';
                  ctx.textAlign = 'center';
                  ctx.fillText('Could not load image preview', canvas.width / 2, canvas.height / 2 - 10);
                  ctx.fillText('Try uploading again', canvas.width / 2, canvas.height / 2 + 20);
                }

                img = document.createElement('img');
                img.src = canvas.toDataURL();
                await new Promise<void>(resolve => {
                  img.onload = () => resolve();
                });

                debug('Created fallback image');
              } catch (fallbackError) {
                debug('Even fallback approach failed:', fallbackError);
                setDebugInfo('Error: All image loading approaches failed');
                throw fallbackError;
              }
            }
          }

          debug('Image loaded, dimensions:', img.width, 'x', img.height);
          setDebugInfo('Image loaded, preparing canvas...');

          // Get source size
          const sourceSize = selectedImageData.size;

          // Create a canvas element
          debug('Creating canvas');
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          debug('Original dimensions:', { width, height });

          // Resize image if needed while maintaining aspect ratio
          if (settings.showSizeControls && (width > settings.maxWidth || height > settings.maxHeight)) {
            const ratio = Math.min(
              settings.maxWidth / width,
              settings.maxHeight / height
            );
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
            debug('Resized dimensions:', { width, height, ratio });
          }

          // Handle empty dimensions - set minimums
          if (width <= 0) width = 100;
          if (height <= 0) height = 100;

          debug('Setting canvas size to:', width, 'x', height);
          canvas.width = width;
          canvas.height = height;

          // Draw the image on the canvas
          debug('Getting canvas context');
          setDebugInfo('Drawing image on canvas...');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            const error = new Error('Could not get canvas context');
            debug('Canvas context error:', error);
            setDebugInfo('Error: Could not get canvas context');
            throw error;
          }

          try {
            debug('Drawing image on canvas');
            ctx.drawImage(img, 0, 0, width, height);

            // Apply sharpening if enabled
            if (settings.applySharpening && settings.sharpeningAmount) {
              debug('Applying sharpening');
              ctx.globalCompositeOperation = 'overlay';
              ctx.globalAlpha = settings.sharpeningAmount;
              ctx.drawImage(img, 0, 0, width, height);
              ctx.globalCompositeOperation = 'source-over';
              ctx.globalAlpha = 1;
            }

            debug('Canvas drawing completed');
          } catch (drawError) {
            debug('Error drawing image on canvas:', drawError);
            setDebugInfo('Error: Could not draw image on canvas');
            throw drawError;
          }

          // Convert canvas to a data URL instead of a blob to avoid URL.createObjectURL issues
          debug('Converting canvas to data URL');
          setDebugInfo('Generating final preview...');

          try {
            const mimeType = `image/${settings.format}`;
            debug('Using mimetype:', mimeType, 'with quality:', settings.quality);

            const dataUrl = canvas.toDataURL(mimeType, settings.quality);
            debug('Data URL generated, starts with:', dataUrl.substring(0, 30) + '...');

            // For size calculation, we still need the blob
            debug('Creating blob for size calculation');
            const blob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob(
                (newBlob) => {
                  if (newBlob) {
                    debug('Blob created, size:', newBlob.size);
                    resolve(newBlob);
                  } else {
                    const error = new Error('Error creating blob');
                    debug('Blob creation failed');
                    reject(error);
                  }
                },
                mimeType,
                settings.quality
              );
            });

            const previewSize = blob.size;
            const ratio = (sourceSize / previewSize).toFixed(2);

            debug('Preview generated successfully:', {
              originalSize: sourceSize,
              previewSize,
              ratio,
              isDataUrl: dataUrl.startsWith('data:')
            });

            // Use the data URL directly
            setDebugInfo('Preview ready!');
            setLivePreviewUrl(dataUrl);
            setLivePreviewSize(previewSize);
            setCompressionRatio(parseFloat(ratio));
          } catch (dataUrlError) {
            debug('Error converting canvas to data URL:', dataUrlError);
            setDebugInfo('Error: Failed to create preview image');
            throw dataUrlError;
          }
        } catch (error) {
          debug('Error generating live preview:', error);
          setDebugInfo(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

          // Clear potentially stale preview data on error
          if (livePreviewUrl && livePreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(livePreviewUrl);
          }
          setLivePreviewUrl(null);
          setLivePreviewSize(null);
          setCompressionRatio(null);
        } finally {
          setIsGeneratingPreview(false);
        }
      }, 300); // Debounce for 300ms
    }

    // Always include cleanup, even if the main effect didn't run
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [selectedImageData, settings, isGeneratingPreview]);

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

  const handleMouseDown = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(position);
    },
    []
  );

  // Set up event listeners for mouse movements outside the component
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleMouseMove(e);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [handleMouseMove]);

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

  // Always show the preview container if we have images, even if not all data is ready
  const previewUrl = selectedImageData?.compressedUrl || livePreviewUrl;
  const previewSize = selectedImageData?.compressedSize || livePreviewSize;
  const previewRatio = selectedImageData?.compressionRatio || compressionRatio;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
      <h2 className="text-xl font-semibold mb-2">
        {selectedImageData?.compressedUrl ? 'Before / After Comparison' : 'Live Preview'}
        {isGeneratingPreview && !selectedImageData?.compressedUrl && (
          <span className="ml-2 text-sm text-primary-500 animate-pulse">
            (Updating...)
          </span>
        )}
      </h2>

      {/* Debug status display */}
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
          {previewUrl && (
            <div className="truncate text-xs mt-1 text-blue-500">
              Preview URL type: {previewUrl.substring(0, 5)}...
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
        <div>
          {selectedImageData && (
            <>Original: {formatFileSize(selectedImageData.size)}</>
          )}
        </div>
        <div>
          {previewUrl && previewSize ? (
            <>
              {selectedImageData?.compressedUrl ? 'Compressed' : 'Preview'}: {formatFileSize(previewSize)}
              {previewRatio && (
                <span className="ml-2 text-green-600 dark:text-green-400">
                  ({previewRatio}x smaller)
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

      <div
        className="relative h-64 w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 select-none border border-gray-200 dark:border-gray-600"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onTouchMove={(e) => {
          if (!isDraggingRef.current || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const x = e.touches[0].clientX - rect.left;
          const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
          setSliderPosition(position);
        }}
      >
        {/* Original Image (Background) */}
        {selectedImageData && (
          <div className="absolute inset-0 w-full h-full">
            <div className="relative w-full h-full">
              {/* Use regular img tag instead of Next.js Image for better compatibility */}
              <img
                src={originalImageDataUrl || selectedImageData.url}
                alt="Original"
                className="object-contain w-full h-full"
                onError={(e) => {
                  debug('Original image failed to load:', e);

                  // Try to get blob data directly if it's a blob URL
                  if (selectedImageData.url.startsWith('blob:')) {
                    debug('Attempting direct fetch of blob data');
                    fetch(selectedImageData.url)
                      .then(response => response.blob())
                      .then(blob => {
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (reader.result && typeof reader.result === 'string') {
                            debug('Successfully fetched blob data');
                            (e.target as HTMLImageElement).src = reader.result;
                          }
                        };
                        reader.readAsDataURL(blob);
                      })
                      .catch(error => {
                        debug('Failed to fetch blob data:', error);
                        // Show a placeholder for the failed image
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMzIiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIj5JbWFnZSBMb2FkIEVycm9yPC90ZXh0Pjwvc3ZnPg==';
                      });
                  } else {
                    // Show a placeholder for the failed image
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMzIiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIj5JbWFnZSBMb2FkIEVycm9yPC90ZXh0Pjwvc3ZnPg==';
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* If we have a preview, show it with the slider */}
        {previewUrl ? (
          <>
            {/* Compressed/Preview Image (Foreground with clip) */}
            <div
              className="absolute inset-0 h-full overflow-hidden"
              style={{ width: `${sliderPosition}%` }}
            >
              <div className="relative w-full h-full" style={{ width: `${100 / (sliderPosition / 100)}%` }}>
                {/* Use regular img tag instead of Next.js Image for better compatibility */}
                <img
                  src={previewUrl}
                  alt="Compressed Preview"
                  className="object-contain w-full h-full"
                  onError={(e) => {
                    debug('Preview image failed to load:', e);
                    debug('Preview URL type:', previewUrl?.substring(0, 30) + '...');

                    // Try to set the source again from our local data property
                    if (livePreviewUrl) {
                      debug('Attempting recovery with known data URL');
                      (e.target as HTMLImageElement).src = livePreviewUrl;
                    } else {
                      // Show a placeholder for the failed image
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMzIiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIj5QcmV2aWV3IExvYWQgRXJyb3I8L3RleHQ+PC9zdmc+';
                    }
                  }}
                />
              </div>
            </div>

            {/* Slider Line and Handle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white dark:bg-gray-200 cursor-ew-resize shadow-md"
              style={{ left: `${sliderPosition}%` }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
            >
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-gray-200 shadow-lg border border-gray-300 flex items-center justify-center">
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
          // Show loading or instruction state if no preview is available
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
                  {selectedImageData ? 'Adjust compression settings to see the preview' : 'Select an image to preview'}
                </p>

                {/* Show error message if there was a failure */}
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
        {previewUrl && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs font-bold rounded px-2 py-1 pointer-events-none">
            {selectedImageData?.compressedUrl ? 'Compressed' : 'Live Preview'}
          </div>
        )}
      </div>

      {/* Image Selector */}
      {images.length > 1 && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Images
          </label>
          <div className="flex overflow-x-auto space-x-3 pb-2">
            {images.map(image => (
              <div
                key={image.id}
                className={`
                  relative cursor-pointer flex-shrink-0 w-20 h-20 rounded-md overflow-hidden
                  ${selectedImage === image.id ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-gray-800' : 'border border-gray-200 dark:border-gray-600 hover:opacity-90'}
                `}
                onClick={() => {
                  debug('Selected image:', image.id, image.name);
                  setSelectedImage(image.id);
                }}
              >
                {/* Use regular img tag for thumbnails */}
                <img
                  src={image.compressedUrl || image.url}
                  alt={image.name}
                  className="object-cover w-full h-full"
                  onError={(e) => {
                    debug('Thumbnail load error for image:', image.id, image.name);
                    // Fallback to a colored placeholder based on image name
                    const hash = image.name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                    const hue = hash % 360;
                    (e.target as HTMLImageElement).src = `data:image/svg+xml;base64,${btoa(`<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" fill="hsl(${hue}, 70%, 80%)"/><text x="50%" y="50%" font-family="Arial" font-size="12" fill="hsl(${hue}, 40%, 30%)" text-anchor="middle" alignment-baseline="middle">${image.name.charAt(0)}</text></svg>`)}`;
                  }}
                />
                {selectedImage === image.id && (
                  <div className="absolute inset-0 bg-primary-500 bg-opacity-20 flex items-center justify-center">
                    <div className="bg-primary-500 rounded-full p-1">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8.736 8.737a1 1 0 01-1.414 0l-3.737-3.737a1 1 0 111.414-1.414L8 13.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
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
}