'use client'
import Image from 'next/image'

const ImageBot = () => {
  return (
    <div className="w-12 h-12 relative">
        <Image src="/images/WappGPT-logo.webp" alt="Bot" width={64} height={64} />
    </div>

  )
}

export default ImageBot