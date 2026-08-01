/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useRef } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';

interface ImageSupportProps {
  images: { uri: string; dataUrl: string; mimeType: string }[];
  onAdd: (image: { uri: string; dataUrl: string; mimeType: string }) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export const ImageSupport: React.FC<ImageSupportProps> = ({
  images,
  onAdd,
  onRemove,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target?.result as string;
        onAdd({
          uri: file.name,
          dataUrl,
          mimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer disabled:opacity-30"
        title="Attach Image"
      >
        <ImageIcon size={14} />
        <span>Attach Image</span>
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        multiple
        className="hidden"
        disabled={disabled}
      />
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {images.map((img, i) => (
            <div
              key={i}
              className="relative group"
            >
              <img
                src={img.dataUrl}
                alt={`attachment-${i}`}
                className="w-12 h-12 object-cover rounded border border-zinc-700/60"
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-900/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} className="text-zinc-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};