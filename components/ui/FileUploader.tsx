'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface FileUploaderProps {
  onFileUpload: (file: File) => void;
  accept?: {
    [key: string]: string[];
  };
  maxSize?: number;
  className?: string;
}

export default function FileUploader({
  onFileUpload,
  accept = {
    'application/pdf': ['.pdf'],
  },
  maxSize = 5 * 1024 * 1024, // 5MB
  className = '',
}: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        onFileUpload(acceptedFiles[0]);
      }
    },
    [onFileUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent/50'
      } ${className}`}
    >
      <input {...getInputProps()} />
      <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
      <p className="text-sm text-muted-foreground text-center mb-2">
        {isDragActive
          ? 'Drop the file here...'
          : 'Drag & drop a file here, or click to select'}
      </p>
      <p className="text-xs text-muted-foreground text-center">
        PDF (max {maxSize / (1024 * 1024)}MB)
      </p>
      <Button type="button" variant="outline" className="mt-4">
        Select File
      </Button>
    </div>
  );
}
