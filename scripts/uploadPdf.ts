import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const pdfPath = path.join(__dirname, '../public/Customer-Service-Handbook.pdf'); // Update this path
const pdfBuffer = fs.readFileSync(pdfPath);
const pdfBase64: string = pdfBuffer.toString('base64');

interface ApiResponse {
  message?: string;
  error?: string;
  [key: string]: any;
}

fetch('http://localhost:3000/api/content-crawler', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'pdf',
    pdfBuffer: pdfBase64,
    businessId: '0919f2b7-9af2-4094-b8b7-f7a70a59599a', // Update this value
    originalUrl: 'local-test.pdf'
  })
})
  .then(res => res.json() as Promise<ApiResponse>)
  .then(console.log)
  .catch(console.error); 