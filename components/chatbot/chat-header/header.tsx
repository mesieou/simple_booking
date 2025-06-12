'use client'

import ImageBot from "./image-bot"
import Status from "./status"
import Icons from "./icons"

const Header = () => {
  return (
    <div className="self-stretch inline-flex justify-center items-center gap-40 bg-blue-500 w-1/2 h-auto">
    <div className="flex justify-start items-start gap-6">
        <div className="w-12 h-12 relative rounded-[53.33px]">
            <ImageBot />
        </div>
        <div className="flex flex-col justify-center items-start">
            <div className="w-48 h-8 relative">
                <div className="absolute left-0 top-0 text-white text-xl font-bold font-['Inter']">SKEDY CHATBOT</div>
            </div>
            <div className="w-11 h-3.5 relative">
            <Status currentStatus={0} />
            </div>
        </div>
    </div>
    <div data-icons="close" style={{width: 24, height: 24, position: 'relative'}}>
        <Icons />
    </div>
</div>
  )
}

export default Header