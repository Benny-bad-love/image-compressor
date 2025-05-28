'use client';

import { useCompressor } from '@/context/CompressorContext';

export default function SettingsPanel() {
  const { settings, updateSettings } = useCompressor();

  // Ensure settings values have defaults to prevent controlled/uncontrolled input errors
  const safeSettings = {
    quality: settings.quality ?? 0.8,
    maxWidth: settings.maxWidth ?? 1920,
    maxHeight: settings.maxHeight ?? 1080,
    format: settings.format ?? 'jpeg',
    preserveExif: settings.preserveExif ?? false,
    applySharpening: settings.applySharpening ?? false,
    sharpeningAmount: settings.sharpeningAmount ?? 0.5,
    showSizeControls: settings.showSizeControls ?? true,
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="space-y-4">
        {/* Quality Slider */}
        <div>
          <label htmlFor="quality" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Quality: {Math.round(safeSettings.quality * 100)}%
          </label>
          <input
            id="quality"
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={safeSettings.quality}
            onChange={(e) => updateSettings({ quality: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
        </div>

        {/* Size Controls Toggle */}
        <div className="flex items-center">
          <input
            id="showSizeControls"
            type="checkbox"
            checked={safeSettings.showSizeControls}
            onChange={(e) => updateSettings({ showSizeControls: e.target.checked })}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
          />
          <label htmlFor="showSizeControls" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Resize images (limit dimensions)
          </label>
        </div>

        {/* Max Dimensions */}
        {safeSettings.showSizeControls && (
          <div className="grid grid-cols-2 gap-4 pl-5 border-l-2 border-primary-100 dark:border-primary-900">
            <div>
              <label htmlFor="maxWidth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Width (px)
              </label>
              <input
                id="maxWidth"
                type="number"
                min="100"
                max="10000"
                value={safeSettings.maxWidth}
                onChange={(e) => updateSettings({ maxWidth: parseInt(e.target.value) })}
                className="border border-gray-300 rounded-md w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label htmlFor="maxHeight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Height (px)
              </label>
              <input
                id="maxHeight"
                type="number"
                min="100"
                max="10000"
                value={safeSettings.maxHeight}
                onChange={(e) => updateSettings({ maxHeight: parseInt(e.target.value) })}
                className="border border-gray-300 rounded-md w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>
        )}

        {/* Output Format */}
        <div>
          <label htmlFor="format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Output Format
          </label>
          <select
            id="format"
            value={safeSettings.format}
            onChange={(e) => updateSettings({ format: e.target.value as 'jpeg' | 'png' | 'webp' })}
            className="border border-gray-300 rounded-md w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </div>

        {/* Preserve EXIF Toggle */}
        <div className="flex items-center">
          <input
            id="preserveExif"
            type="checkbox"
            checked={safeSettings.preserveExif}
            onChange={(e) => updateSettings({ preserveExif: e.target.checked })}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
          />
          <label htmlFor="preserveExif" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Preserve EXIF Data (if supported)
          </label>
        </div>

        {/* Sharpening Options */}
        <div>
          <div className="flex items-center mb-2">
            <input
              id="applySharpening"
              type="checkbox"
              checked={safeSettings.applySharpening}
              onChange={(e) => updateSettings({ applySharpening: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="applySharpening" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Apply Sharpening
            </label>
          </div>

          {safeSettings.applySharpening && (
            <div className="pl-5 border-l-2 border-primary-100 dark:border-primary-900">
              <label htmlFor="sharpeningAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sharpening Amount: {Math.round(safeSettings.sharpeningAmount * 100)}%
              </label>
              <input
                id="sharpeningAmount"
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={safeSettings.sharpeningAmount}
                onChange={(e) => updateSettings({ sharpeningAmount: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}