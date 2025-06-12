'use client'
import Image from 'next/image'

const icons = [
    {
        src: "/images/chatbot-transcript/clipboard-text.webp",
    },
    {
        src: "/images/chatbot-transcript/like.webp",
    },
    {
        src: "/images/chatbot-transcript/dislike.webp",
    }
]

const IconsTranscript = () => { 
    return (
        <div className="left-[261px] top-[72px] inline-flex justify-start items-start gap-1.5">
            <div className="p-1 bg-purple-700 rounded-lg flex justify-start items-start gap-2">
                <Image 
                    src={icons[0].src} alt="clipboard-text" width={24} height={24}
                />
                <Image 
                    src={icons[1].src} alt="like" width={24} height={24}
                />
                <Image 
                    src={icons[2].src} alt="dislike" width={24} height={24}
                />
            </div>
        </div>
    )
}

export default IconsTranscript