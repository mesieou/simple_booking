"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2 } from 'lucide-react';

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EmailDialog({ isOpen, onClose }: EmailDialogProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Aquí puedes agregar la lógica para enviar el email a tu backend
      // Por ejemplo, una llamada a tu API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación de envío
      
      setIsSubmitted(true);
      setTimeout(() => {
        onClose();
        setEmail('');
        setIsSubmitted(false);
      }, 2000);
    } catch (error) {
      console.error('Error al enviar email:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      setEmail('');
      setIsSubmitted(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Únete a la lista de espera
          </DialogTitle>
          <DialogDescription>
            Ingresa tu email para ser notificado cuando lancemos la versión beta.
          </DialogDescription>
        </DialogHeader>
        
        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !email.includes('@')}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Unirse a la lista de espera'
              )}
            </Button>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">¡Gracias por registrarte!</h3>
              <p className="text-sm text-muted-foreground">
                Te notificaremos cuando esté disponible.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 