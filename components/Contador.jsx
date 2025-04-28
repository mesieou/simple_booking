"use client";

import { useState } from 'react';

export default function Contador() {
  const [contador, setContador] = useState(0);

  const aumentar = () => {
    setContador(contador + 1);
  };

  const disminuir = () => {
    setContador(contador - 1);
  };

  const reiniciar = () => {
    setContador(0);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-gray-100 rounded-xl shadow-md w-64 mx-auto mt-10">
      <h1 className="text-2xl font-bold">Contador: {contador}</h1>
      <div className="flex gap-2">
        <button onClick={aumentar} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
          Aumentar
        </button>
        <button onClick={disminuir} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
          Disminuir
        </button>
      </div>
      <button onClick={reiniciar} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded mt-2">
        Reiniciar
      </button>
    </div>
  );
}