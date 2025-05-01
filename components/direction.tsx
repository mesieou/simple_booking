'use client'

export default function Direction({ texto }: { texto: string }) {

    return(
            <div className="w-full">
                <div className="relative">
                    <div className="relative border rounded-xl px-3.5 py-3 flex items-center gap-x-4 flex-wrap transition text-black bg-white border-gray-400 focus-within:border-brand hover:border-brand flex-nowrap border-none !py-1.5">
                        <div className="pointer-events-none flex h-5 w-5 items-center justify-center">
                            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                                    <path fill="currentColor" fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <div className="flex-grow">
                            <label className="block text-label-5 text-left text-gray-600">{texto}</label>
                            <input className="block w-full text-label-2 leading-[1.375] focus:outline-none flex-1 bg-transparent border-none focus:ring-0 placeholder:text-gray-600 text-black caret-black" />
                        </div>
                    </div>
                </div>
            </div>

                


    )
}