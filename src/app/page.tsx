'use client';

import { useState } from 'react';
import DropZone from '@/components/DropZone';
import ImageList from '@/components/ImageList';
import SettingsPanel from '@/components/SettingsPanel';
import BeforeAfterPreview from '@/components/BeforeAfterPreview';
import { CompressorProvider } from '@/context/CompressorContext';
import { useCompressor } from '@/context/CompressorContext';

// Main wrapper component that has access to the CompressorProvider
export default function Home() {
  return (
    <CompressorProvider>
      <MainContent />
    </CompressorProvider>
  );
}

// Inner component with access to the context
function MainContent() {
  const { images } = useCompressor();
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-900 dark:text-white">
          Image Compressor
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left side - Settings and Upload */}
          <div className="lg:col-span-2 space-y-4">
            <div className="mb-5">
              <button
                className="w-full flex justify-between items-center text-left bg-white dark:bg-gray-800 rounded-lg shadow-md px-4 py-3 mb-1"
                onClick={() => setSettingsExpanded(!settingsExpanded)}
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Compression Settings
                </h2>
                <svg
                  className={`w-4 h-4 transition-transform ${settingsExpanded ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {settingsExpanded && <SettingsPanel />}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Upload Images
              </h2>
              <DropZone />
            </div>
          </div>

          {/* Right side - Preview and Image list */}
          <div className="lg:col-span-3 space-y-4">
            <BeforeAfterPreview />

            {images.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 max-h-96 overflow-y-auto" id="image-list-outer-container">
                <ImageList />
              </div>
            )}
          </div>
        </div>

        <footer className="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Image compression happens entirely in your browser.
            Your images are never uploaded to a server.
          </p>
        </footer>
      </div>
    </main>
  );
}