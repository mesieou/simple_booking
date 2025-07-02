'use client'

import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ShareButtonProps {
  title: string
  text?: string
  className?: string
}

const ShareButton = ({ title, text, className = '' }: ShareButtonProps) => {
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title,
        text: text || title,
        url: window.location.href,
      })
    } else {
      // Fallback: copiar URL al clipboard
      navigator.clipboard.writeText(window.location.href)
      // Aquí podrías mostrar un toast de confirmación
      alert('URL copiada al portapapeles')
    }
  }

  return (
    <Button onClick={handleShare} variant="outline" className={`flex items-center gap-2 ${className}`}>
      <Share2 className="w-4 h-4" />
      Compartir artículo
    </Button>
  )
}

export { ShareButton } 