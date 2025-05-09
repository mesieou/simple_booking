export const ciudadesPermitidas = [
  'new york',
  'madrid',
  'barcelona',
  'londres',
  'paris',
  'tokio'
];

export async function validarUbicacion(direccion: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/maps/geocode?direccion=${encodeURIComponent(direccion)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al validar la dirección');
    }

    // Obtener los componentes de la dirección
    const addressComponents = data.results[0].address_components;
    
    // Buscar la ciudad en los componentes de la dirección
    const ciudad = addressComponents.find(
      (component: any) => 
        component.types.includes('locality') || 
        component.types.includes('administrative_area_level_1')
    );

    if (!ciudad) {
      return false;
    }

    const nombreCiudad = ciudad.long_name.toLowerCase();
    
    // Verificar si la ciudad está en la lista de ciudades permitidas
    return ciudadesPermitidas.some(ciudadPermitida => 
      nombreCiudad.includes(ciudadPermitida) || 
      ciudadPermitida.includes(nombreCiudad)
    );
  } catch (error) {
    console.error('Error al validar ubicación:', error);
    return false;
  }
}

export function obtenerMensajeError(direccion: string): string {
  return `La dirección "${direccion}" no está dentro de las ciudades permitidas. Por favor, seleccione una dirección en una de las siguientes ciudades: ${ciudadesPermitidas.join(', ')}`;
} 