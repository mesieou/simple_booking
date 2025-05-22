interface DistanceMatrixElement {
  duration: { value: number };
  status?: string;
}

export const calcularPrecioDesdeApi = (element: DistanceMatrixElement): number => {
  if (element.status && element.status !== 'OK') return 0;
  const minutos = Math.ceil(element.duration.value / 60);
  return minutos * 2;
};

export const segundosAMinutos = (segundos: number): number => Math.ceil(segundos / 60);

export const formatearDuracion = (segundos: number): string => {
  const minutos = Math.ceil(segundos / 60);
  if (minutos < 60) return `${minutos} mins`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return mins === 0 ? `${horas} hours` : `${horas} hours ${mins} mins`;
};
