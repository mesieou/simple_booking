'use client'

const Time = ({ time = "7:20" }) => {
    return (
            <div className="left-[32px] top-[95px] flex justify-start items-end gap-2.5">
              <div className="w-5 h-1.5 relative">
                <div className="left-0 top-0 absolute justify-strart text-white text-[10px] font-normal font-['Inter']">
                  {time}
                </div>
              </div>
            </div>
          )
}

export default Time