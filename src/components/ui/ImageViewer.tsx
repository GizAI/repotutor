'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface FileInfo {
  name: string;
  path: string;
  projectName: string;
}

interface ImageViewerProps {
  file: FileInfo;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ file, onClose }) => {
  const imagePath = `/api/projects/${file.projectName}/files/content?path=${encodeURIComponent(file.path)}`;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | undefined;
    const controller = new AbortController();

    const loadImage = async () => {
      try {
        setLoading(true);
        setError(null);
        setImageUrl(null);

        const response = await fetch(imagePath, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        console.error('Error loading image:', err);
        setError('Unable to load image');
      } finally {
        setLoading(false);
      }
    };

    loadImage();

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imagePath]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 overflow-hidden"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <h3
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {file.name}
          </h3>
          <button
            onClick={onClose}
            className="h-8 w-8 p-0 rounded hover:bg-opacity-80 transition-colors"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <X className="h-4 w-4 mx-auto" style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>

        <div
          className="p-4 flex justify-center items-center min-h-[400px]"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          {loading && (
            <div className="text-center" style={{ color: 'var(--text-muted)' }}>
              <p>Loading image…</p>
            </div>
          )}
          {!loading && imageUrl && (
            <img
              src={imageUrl}
              alt={file.name}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
            />
          )}
          {!loading && !imageUrl && (
            <div className="text-center" style={{ color: 'var(--text-muted)' }}>
              <p>{error || 'Unable to load image'}</p>
              <p className="text-sm mt-2 break-all">{file.path}</p>
            </div>
          )}
        </div>

        <div
          className="p-4 border-t"
          style={{
            borderColor: 'var(--border-color)',
            backgroundColor: 'var(--bg-secondary)'
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {file.path}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;
