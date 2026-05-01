import * as THREE from 'three'

/**
 * Calcula la distancia euclidiana tridimensional entre dos puntos.
 *
 * @param a - Primer punto en el espacio 3D
 * @param b - Segundo punto en el espacio 3D
 * @returns Distancia en metros redondeada a 2 decimales
 */
export function euclideanDistance(a: THREE.Vector3, b: THREE.Vector3): number {
  return parseFloat(a.distanceTo(b).toFixed(2))
}
