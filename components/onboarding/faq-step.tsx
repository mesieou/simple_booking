'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Upload, FileText, X, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadCustomerTemplate } from '@/lib/knowledge-base/client';
import { BusinessCategoryType } from '@/lib/config/business-templates';

interface FaqStepProps {
  data: {
    faqDocument?: File | null;
    faqDocumentName?: string;
    faqDocumentSize?: number;
    businessName?: string;
    businessCategory?: string;
  };
  onUpdate: (data: any) => void;
}

export function FaqStep({ data, onUpdate }: FaqStepProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File) => {
    // Check file type
    if (file.type !== 'application/pdf') {
      return 'Please upload a PDF file only.';
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      return 'File size must be less than 10MB.';
    }
    
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      return;
    }

    setUploadError(null);
    onUpdate({
      faqDocument: file,
      faqDocumentName: file.name,
      faqDocumentSize: file.size
    });
  }, [onUpdate]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleRemoveFile = useCallback(() => {
    onUpdate({
      faqDocument: null,
      faqDocumentName: '',
      faqDocumentSize: 0
    });
    setUploadError(null);
  }, [onUpdate]);

  const handleDownloadTemplate = useCallback(() => {
    // Map business category string to BusinessCategoryType
    let businessCategory: BusinessCategoryType;
    if (data.businessCategory === 'removalist' || data.businessCategory === 'removalists') {
      businessCategory = 'removalist';
    } else if (data.businessCategory === 'salon' || data.businessCategory === 'hair salon' || data.businessCategory === 'beauty salon') {
      businessCategory = 'salon';
    } else {
      businessCategory = 'removalist'; // Default fallback
    }

    downloadCustomerTemplate(data.businessName || '[Your Business Name]', businessCategory);
  }, [data.businessName, data.businessCategory]);

  return (
    <div className="space-y-6">
      {/* Optional Upload Area */}
      <Card className="border border-gray-200">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600" />
            Additional Q&A (Optional)
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-gray-700">
            Upload additional questions and answers unique to your business like cancellation policy, special procedures, etc. (Max size: 10MB)
          </CardDescription>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 flex-1">
              <strong>Need help getting started?</strong> Download our template with sample questions.
            </p>
            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
              size="sm"
              className="shrink-0 w-full sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {!data.faqDocument ? (
            <div className="space-y-4">
              {/* Drop Zone */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 sm:p-8 text-center transition-colors cursor-pointer",
                  isDragOver 
                    ? "border-primary bg-primary/5" 
                    : "border-gray-300 hover:border-primary/50 hover:bg-gray-50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('faq-file-input')?.click()}
              >
                <Upload className={cn(
                  "w-8 sm:w-12 h-8 sm:h-12 mx-auto mb-3 sm:mb-4",
                  isDragOver ? "text-primary" : "text-gray-400"
                )} />
                <div className="space-y-1 sm:space-y-2">
                  <p className="text-base sm:text-lg font-medium text-gray-900">
                    Drop your FAQ PDF here, or click to browse
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Supports PDF files up to 10MB
                  </p>
                </div>
              </div>

              {/* Hidden File Input */}
              <input
                id="faq-file-input"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileInput}
                className="hidden"
              />

              {/* Upload Error */}
              {uploadError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              )}

              {/* Optional Notice */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">
                  <strong>Optional:</strong> You can skip this step and add your FAQ document later 
                  from your dashboard if you don't have one ready.
                </p>
              </div>
            </div>
          ) : (
            /* File Uploaded */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">
                    {data.faqDocumentName}
                  </p>
                  <p className="text-sm text-green-600">
                    {data.faqDocumentSize ? formatFileSize(data.faqDocumentSize) : ''}
                  </p>
                </div>
                <Button
                  onClick={handleRemoveFile}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  ✅ Your FAQ document has been uploaded successfully! 
                  It will be processed and integrated into your customer support system.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FAQ Benefits */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">
            How Your FAQ Document Helps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Instant Customer Support</p>
                <p className="text-sm text-gray-600">Customers get immediate answers to common questions</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Reduce Support Workload</p>
                <p className="text-sm text-gray-600">Automate responses to frequently asked questions</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Better Customer Experience</p>
                <p className="text-sm text-gray-600">24/7 availability for customer inquiries</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}