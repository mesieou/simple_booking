'use client'

import React, { useState } from "react";
import { useToast } from "@/lib/rename-categorise-better/utils/use-toast"
import FileUpload from "@components/ui/FileUploader";

const PDFParser = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const [parsedText, setParsedText] = useState("");
  const [categorized, setCategorized] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    toast({
      variant: "default",
      title: "File Uploaded",
      description: `${file.name} has been uploaded successfully.`,
    });
    setLoading(true);
    // Prepare form data
    const formData = new FormData();
    formData.append("file", file);
    formData.append("228c7e8e-ec15-4eeb-a766-d1ebee07104f", "test-business-id"); // Replace as needed
    
    try {
      // Call API
      const res = await fetch("/api/content-crawler/pdf", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.result) {
        setParsedText(data.result.mergedText);
        setCategorized(data.result.categorizedSections || []);
        toast({
          variant: "default",
          title: "Processing Complete",
          description: `PDF "${data.pdfName}" has been processed successfully.`,
        });
      } else {
        throw new Error('No result data received');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">PDF Parser & Categorizer</h2>
      <FileUpload
        onFileUpload={handleFileUpload}
        maxSize={8 * 1024 * 1024}
      />
      {loading && (
        <div className="mt-6 flex items-center justify-center">
          <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-32 w-32"></div>
        </div>
      )}
      {parsedText && (
        <div className="mt-6 w-full max-w-3xl p-4 rounded shadow">
          <h3 className="text-xl font-semibold mb-2">Parsed Text</h3>
          <p className="p-4 rounded whitespace-pre-wrap">
            {parsedText}
          </p>
        </div>
      )}
      {categorized && categorized.length > 0 && (
        <div className="mt-6 w-full max-w-3xl p-4 rounded shadow">
          <h3 className="text-xl font-semibold mb-2">Categorized Content</h3>
          <pre className="p-4 rounded whitespace-pre-wrap text-xs overflow-x-auto">
            {JSON.stringify(categorized, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default PDFParser; 