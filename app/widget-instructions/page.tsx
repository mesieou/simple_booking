'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, ExternalLink } from 'lucide-react';

export default function WhatsAppWidgetInstructions() {
  const [businessId, setBusinessId] = useState('782e1021-058f-4eb1-b3fe-9c374d814799');
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://skedy.io';

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const iframeCode = `<iframe 
  src="${baseUrl}/api/widget/embed?businessId=${businessId}" 
  width="300" 
  height="150" 
  style="position: fixed; bottom: 20px; right: 20px; border: none; z-index: 9999; background: transparent;"
  frameborder="0">
</iframe>`;

  const scriptCode = `<script>
(function() {
  var iframe = document.createElement('iframe');
  iframe.src = '${baseUrl}/api/widget/embed?businessId=${businessId}';
  iframe.style.position = 'fixed';
  iframe.style.bottom = '20px';
  iframe.style.right = '20px';
  iframe.style.width = '300px';
  iframe.style.height = '150px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '9999';
  iframe.style.backgroundColor = 'transparent';
  iframe.frameBorder = '0';
  document.body.appendChild(iframe);
})();
</script>`;

  const htmlCode = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Website</title>
</head>
<body>
    <!-- Your website content goes here -->
    
    <!-- WhatsApp Widget -->
    ${iframeCode}
</body>
</html>`;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">WhatsApp Widget for Your Website</h1>
        <p className="text-muted-foreground">
          Add a floating WhatsApp button to your website so customers can easily contact you via WhatsApp.
        </p>
      </div>

      <div className="mb-6">
        <Label htmlFor="business-id">Your Business ID</Label>
        <Input
          id="business-id"
          value={businessId}
          onChange={(e) => setBusinessId(e.target.value)}
          placeholder="Enter your business ID"
          className="mt-2"
        />
        <p className="text-sm text-muted-foreground mt-1">
          This ID connects the widget to your WhatsApp number and business name.
        </p>
      </div>

      <Alert className="mb-6">
        <ExternalLink className="h-4 w-4" />
        <AlertDescription>
          <strong>Live Preview:</strong> You can see the widget in action on this website! 
          Look for the green WhatsApp button in the bottom-right corner.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="iframe" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="iframe">Simple Iframe</TabsTrigger>
          <TabsTrigger value="script">JavaScript</TabsTrigger>
          <TabsTrigger value="html">Full HTML</TabsTrigger>
        </TabsList>

        <TabsContent value="iframe">
          <Card>
            <CardHeader>
              <CardTitle>Simple Iframe Method</CardTitle>
              <CardDescription>
                The easiest way to add the widget. Just copy and paste this code before the closing &lt;/body&gt; tag.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{iframeCode}</code>
                </pre>
                <Button
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(iframeCode, 'iframe')}
                >
                  {copied === 'iframe' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                <p><strong>Pros:</strong> Simple, works on any website</p>
                <p><strong>Cons:</strong> Always visible (doesn't respect page navigation)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="script">
          <Card>
            <CardHeader>
              <CardTitle>JavaScript Method</CardTitle>
              <CardDescription>
                More flexible approach that dynamically creates the widget. Recommended for most websites.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{scriptCode}</code>
                </pre>
                <Button
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(scriptCode, 'script')}
                >
                  {copied === 'script' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                <p><strong>Pros:</strong> More control, can be conditionally loaded</p>
                <p><strong>Cons:</strong> Requires JavaScript knowledge for customization</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="html">
          <Card>
            <CardHeader>
              <CardTitle>Complete HTML Example</CardTitle>
              <CardDescription>
                A full HTML page example showing how to integrate the widget into your website.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm max-h-96">
                  <code>{htmlCode}</code>
                </pre>
                <Button
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(htmlCode, 'html')}
                >
                  {copied === 'html' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                <p><strong>Use this as a template</strong> for your own HTML pages.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Installation Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">For WordPress</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Go to Appearance → Theme Editor</li>
                <li>Open footer.php or your theme's main template</li>
                <li>Paste the code before &lt;/body&gt;</li>
                <li>Save changes</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold mb-2">For Shopify</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Go to Online Store → Themes</li>
                <li>Click Actions → Edit Code</li>
                <li>Open theme.liquid</li>
                <li>Paste the code before &lt;/body&gt;</li>
                <li>Save</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold mb-2">For Wix</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Open Wix Editor</li>
                <li>Click Settings → Custom Code</li>
                <li>Add new code to Body - End</li>
                <li>Paste the code and save</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold mb-2">For Squarespace</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Go to Settings → Advanced → Code Injection</li>
                <li>Paste code in Footer section</li>
                <li>Save changes</li>
                <li>The widget will appear on all pages</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Widget Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">✨ What it does:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Shows a floating WhatsApp button</li>
                <li>Displays your business name on hover</li>
                <li>Opens WhatsApp with a pre-filled message</li>
                <li>Works on mobile and desktop</li>
                <li>Includes a subtle bounce animation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🎨 Styling:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>WhatsApp green gradient background</li>
                <li>Fixed position (bottom-right corner)</li>
                <li>Responsive design</li>
                <li>Smooth hover effects</li>
                <li>No impact on your website's layout</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 