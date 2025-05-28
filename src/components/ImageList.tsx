'use client';

import { useCompressor } from '@/context/CompressorContext';
import { formatFileSize } from '@/utils/formatters';
import Image from 'next/image';

export default function ImageList() {
  const {
    images,
    removeImage,
    compressImage,
    downloadImage,
    compressAllImages,
    downloadAllImages,
    clearImages,
    selectedImage,
    setSelectedImage
  } = useCompressor();

  if (images.length === 0) {
    return null;
  }

  const pendingImages = images.filter(img => img.status === 'pending');
  const compressedImages = images.filter(img => img.status === 'compressed');
  const hasCompressedImages = compressedImages.length > 0;
  const allCompressed = pendingImages.length === 0;

  return (
    <>
      <div className="flex justify-between items-center mb-4" id="image-list-header">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Images ({images.length})
        </h2>
        <div className="flex flex-wrap gap-2 justify-end">
          {pendingImages.length > 0 && (
            <button
              onClick={compressAllImages}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Compress All
            </button>
          )}

          {hasCompressedImages && (
            <button
              onClick={downloadAllImages}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download All
            </button>
          )}

          <button
            onClick={clearImages}
            className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-gray-600 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear All
          </button>
        </div>
      </div>

      <div className="overflow-hidden overflow-x-auto overflow-y-auto max-h-96" id="image-list-table-container">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Image
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                File info
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {images.map(image => (
              <tr
                key={image.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  selectedImage === image.id ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div
                    className="relative w-12 h-12 cursor-pointer rounded overflow-hidden"
                    onClick={() => setSelectedImage(image.id)}
                  >
                    <Image
                      src={image.compressedUrl || image.url}
                      alt={image.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                    {selectedImage === image.id && (
                      <div className="absolute top-0 right-0 bg-primary-500 m-0.5 rounded-full p-0.5">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs" title={image.name}>
                    {image.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Original: {formatFileSize(image.size)}
                    {image.compressedSize && (
                      <span className="ml-3">
                        Compressed: {formatFileSize(image.compressedSize)}
                        {image.compressionRatio && (
                          <span className="ml-1 text-green-600 dark:text-green-400">
                            ({image.compressionRatio}x smaller)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${image.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:bg-opacity-30 dark:text-yellow-200' : ''}
                    ${image.status === 'compressing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:bg-opacity-30 dark:text-blue-200' : ''}
                    ${image.status === 'compressed' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:bg-opacity-30 dark:text-green-200' : ''}
                    ${image.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:bg-opacity-30 dark:text-red-200' : ''}
                  `}>
                    {image.status === 'pending' && 'Ready to compress'}
                    {image.status === 'compressing' && (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Compressing
                      </>
                    )}
                    {image.status === 'compressed' && 'Compressed'}
                    {image.status === 'error' && 'Error'}
                  </span>
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  {image.status === 'pending' && (
                    <button
                      onClick={() => compressImage(image.id)}
                      className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                    >
                      Compress
                    </button>
                  )}

                  {image.status === 'compressed' && (
                    <button
                      onClick={() => downloadImage(image.id)}
                      className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                    >
                      Download
                    </button>
                  )}

                  <button
                    onClick={() => removeImage(image.id)}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}