'use client'

const Message = ({ message, isSystem }: { message: string, isSystem: boolean }) => {
    return (
        
        <div className="max-w-md mx-auto p-4">
        <div className="relative">
        {/* Burbuja principal del mensaje */}
        <div className={`
          relative px-5 py-4 pb-8 shadow-sm
          ${isSystem 
            ? 'bg-purple-950 text-white rounded-t-xl rounded-br-xl' 
            : 'bg-blue-500 text-white rounded-t-xl rounded-bl-xl'
          }
        `}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="text-base font-normal leading-relaxed">
                {message}
              </p>
            </div>
          </div>
            
            {/* Cola redondeada */}
            <div className={`
            absolute -bottom-1 w-3 h-3 transform rotate-45
            ${isSystem 
              ? 'left-2 bg-purple-950 rounded-bl-sm' 
              : 'right-2 bg-blue-500 rounded-br-sm'
            }
          `} />
        </div>
        </div>
      </div>
          )
    
}

export default Message  