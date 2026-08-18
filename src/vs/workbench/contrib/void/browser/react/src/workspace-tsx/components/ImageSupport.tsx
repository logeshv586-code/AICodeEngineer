/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useRef } from 'react';
import { Image as ImageIcon, X, Images } from 'lucide-react';

export interface ImageAttachment {
  uri: string;
  dataUrl: string;
  mimeType: string;
}

interface ImageSupportProps {
  images: ImageAttachment[];
  onAdd: (image: ImageAttachment) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  maxImages?: number;
}

export const ImageSupport: React.FC<ImageSupportProps> = ({
  images,
  onAdd,
  onRemove,
  disabled = false,
  maxImages = 8,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, maxImages - images.length);

  const addFiles = useCallback((files: File[]) => {
    if (disabled || remaining <= 0) return;
    files.filter(file => file.type.startsWith('image/')).slice(0, remaining).forEach(file => {
      const reader = new FileReader();
      reader.onload = event => {
        const dataUrl = String(event.target?.result || '');
        if (!dataUrl) return;
        onAdd({
          uri: (file as File & { path?: string }).path || file.name,
          dataUrl,
          mimeType: file.type || 'image/png',
        });
      };
      reader.readAsDataURL(file);
    });
  }, [disabled, onAdd, remaining]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files || []));
    event.target.value = '';
  }, [addFiles]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files || []));
  }, [addFiles]);

  return (
    <div className='flex flex-col gap-1' onDragOver={event => { if (!disabled) event.preventDefault(); }} onDrop={handleDrop}>
      <button
        type='button'
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || remaining <= 0}
        className='flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed'
        title={remaining > 0 ? `Attach images (${remaining} remaining)` : `Maximum ${maxImages} images attached`}
      >
        <ImageIcon size={14} />
        <span>Attach Image</span>
        {images.length > 0 && <span className='text-[9px] text-zinc-600'>{images.length}/{maxImages}</span>}
      </button>
      <input type='file' ref={fileInputRef} onChange={handleFileSelect} accept='image/*' multiple className='hidden' disabled={disabled || remaining <= 0} />

      {images.length === 0 && !disabled && (
        <div className='flex items-center gap-1 px-2 py-1 text-[9px] text-zinc-700 border border-dashed border-zinc-800 rounded'>
          <Images size={10} /> Drop screenshots or reference images here
        </div>
      )}

      {images.length > 0 && (
        <div className='flex flex-wrap gap-1'>
          {images.map((image, index) => (
            <div key={`${image.uri}-${index}`} className='relative group' title={image.uri}>
              <img src={image.dataUrl} alt={image.uri.split(/[\\/]/).pop() || `attachment-${index + 1}`} className='w-12 h-12 object-cover rounded border border-zinc-700/60' />
              <button
                type='button'
                onClick={() => onRemove(index)}
                className='absolute -top-1 -right-1 w-4 h-4 bg-zinc-950 border border-zinc-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity'
                title='Remove image'
                aria-label={`Remove image ${index + 1}`}
              >
                <X size={10} className='text-zinc-400' />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};