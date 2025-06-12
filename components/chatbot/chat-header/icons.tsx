'use client'
import Image from 'next/image'

const icons = [
    {
        image: '/images/chatbot-icons/close-circle.webp',
    },
    {
        image: '/images/chatbot-icons/minus-circle.webp',
    },
    {
        image: '/images/chatbot-icons/more-circle.webp',
    },
]
const IconsHeader = () => {
  return (
    <div className="w-6 h-6 relative">
        <Image src={icons[2].image} alt="close-circle" width={24} height={24} />
    </div>
  )
}

export default IconsHeader