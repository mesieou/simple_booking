'use client'

import Message from './message'
import IconsTranscript from './icons'
import Time from './time'

const Transcript = () => {
  return (
    <div className="relative w-[400px] flex flex-col gap-2">
      <div>
        <Message 
          message="¡Hola! ¿En qué puedo ayudarte hoy?" 
          isSystem={true} 
        />
        <div className="flex flex-row items-end justify-between mt-[-18px] pl-10 pr-4">
          <Time time="7:20" />
          <IconsTranscript />
        </div>
      </div>
    </div>
  )
}

export default Transcript
