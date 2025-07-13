"use client";

import { Paperclip, Smile, Mic, Phone, Video, MoreVertical, ArrowLeft } from "lucide-react";
import Image from "next/image";

// Componente SVG para el doble check azul estilo WhatsApp
const CheckDouble = ({ className = "", ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width={14}
    height={14}
    {...props}
  >
    <path d="M3 10.5L7.5 15L17 5.5" stroke="#2196f3" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8.5 10.5L12.5 14.5" stroke="#2196f3" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ChatDemo = () => {
  return (
    <div
      className="w-full max-w-[320px] mx-auto overflow-hidden shadow-lg border border-stone-300 bg-[#ece5dd] relative"
      style={{ minWidth: '280px' }}
      aria-label="Demo de chat estilo WhatsApp"
    >
      {/* Header */}
      <div className="flex items-center gap-3 bg-white px-4 py-3">
        <div className="flex items-center gap-2 flex-1">
          <span tabIndex={0} aria-label="Volver" className="text-black cursor-pointer focus:outline-none"><ArrowLeft className="w-5 h-5" /></span>
          <div className="w-9 h-9 flex items-center justify-center overflow-hidden border border-gray-300 rounded-full">
            <Image
              src="/favicon.png"
              alt="Imagen de perfil"
              width={36}
              height={36}
              className="rounded-full object-cover w-9 h-9"
              aria-label="Imagen de perfil"
              priority
            />
          </div>
          <div className="flex flex-col ml-1">
            <span className="text-black font-semibold leading-tight text-sm">Chatbot</span>
            <span className="text-black text-xs leading-tight">en línea</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-black" aria-label="Llamar" tabIndex={0} />
          <Video className="w-5 h-5 text-black" aria-label="Videollamada" tabIndex={0} />
          <MoreVertical className="w-5 h-5 text-black" aria-label="Más opciones" tabIndex={0} />
        </div>
      </div>

      {/* Mensajes */}
      <div className="px-3 py-4 h-80 bg-[url('/public/icons_size/whatsapp-bg.png')] bg-repeat bg-opacity-10 overflow-y-auto flex flex-col gap-3">
        {/* Mensaje enviado */}
        <div className="flex justify-end">
          <div className="bg-[#dcf8c6] px-3 py-2 shadow text-sm max-w-[80%] relative">
            <span className="text-black">Hola, me gustaría reservar un servicio para mañana a las 10am.</span>
            <span className="flex items-center gap-1 absolute bottom-1 right-2 text-[10px] text-gray-400 select-none">
              12:40
              <CheckDouble className="w-3 h-3 ml-1" aria-label="Leído" />
            </span>
          </div>
        </div>
        {/* Mensaje recibido */}
        <div className="flex justify-start">
          <div className="bg-white px-3 py-2 shadow text-sm max-w-[80%] relative">
            <span className="text-black">¡Hola! Claro, ¿podrías confirmarme el tipo de servicio que deseas reservar?</span>
            <span className="absolute bottom-1 right-2 text-[10px] text-gray-400 select-none">12:41</span>
          </div>
        </div>
      </div>

      {/* Input de mensaje */}
      <div className="flex items-center gap-2 bg-transparent px-2 py-3 border-t border-stone-200">
        <div className="flex flex-1 items-center bg-white rounded-full shadow-sm px-2 h-9">
          <button tabIndex={0} aria-label="Emoji" className="text-gray-500 hover:text-green-600 focus:outline-none"><Smile className="w-5 h-5" /></button>
          <input
            type="text"
            placeholder="Mensaje"
            className="flex-1 bg-transparent border-none outline-none text-black placeholder-gray-500 text-sm"
            aria-label="Escribe un mensaje"
          />
          <button tabIndex={0} aria-label="Adjuntar archivo" className="text-gray-500 hover:text-green-600 focus:outline-none"><Paperclip className="w-4 h-4" /></button>
          <button tabIndex={0} aria-label="Cámara" className="text-gray-500 hover:text-green-600 focus:outline-none">
            {/* Icono de cámara SVG inline */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553 2.276A2 2 0 0121 14.118V17a2 2 0 01-2 2H5a2 2 0 01-2-2v-2.882a2 2 0 01.447-1.842L8 10m7 0V7a2 2 0 00-2-2h-2a2 2 0 00-2 2v3m7 0H8" /></svg>
          </button>
        </div>
        <button tabIndex={0} aria-label="Enviar mensaje de voz" className="flex items-center justify-center bg-green-500 hover:bg-green-600 w-9 h-9 rounded-full focus:outline-none">
          <Mic className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
};

export default ChatDemo; 