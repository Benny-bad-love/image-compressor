export interface ImageFile {
  id: string;
  name: string;
  file: File;
  url: string;
  size: number;
  compressedUrl?: string;
  compressedSize?: number;
  compressionRatio?: number;
  status: 'pending' | 'compressing' | 'compressed' | 'error';
  error?: string;
  compressionSettings?: CompressionSettings;
}

export interface CompressionSettings {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  format: 'jpeg' | 'png' | 'webp';
  preserveExif: boolean;
  applySharpening: boolean;
  sharpeningAmount?: number;
  showSizeControls: boolean;
}

export interface CompressorContextType {
  images: ImageFile[];
  settings: CompressionSettings;
  addImages: (files: File[]) => void;
  removeImage: (id: string) => void;
  updateSettings: (settings: Partial<CompressionSettings>) => void;
  compressImage: (id: string) => Promise<void>;
  compressAllImages: () => Promise<void>;
  downloadImage: (id: string) => void;
  downloadAllImages: () => void;
  downloadAsZip: () => Promise<void>;
  clearImages: () => void;
  selectedImage: string | null;
  setSelectedImage: (id: string | null) => void;
}