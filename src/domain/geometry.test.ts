import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { euclideanDistance } from './geometry'

describe('euclideanDistance', () => {
  it('devuelve 0 para dos puntos idénticos', () => {
    const p = new THREE.Vector3(1, 2, 3)
    expect(euclideanDistance(p, p)).toBe(0)
  })

  it('calcula la distancia correcta en el eje X', () => {
    const a = new THREE.Vector3(0, 0, 0)
    const b = new THREE.Vector3(5, 0, 0)
    expect(euclideanDistance(a, b)).toBe(5)
  })

  it('calcula la distancia correcta en el eje Y', () => {
    const a = new THREE.Vector3(0, 0, 0)
    const b = new THREE.Vector3(0, 3, 0)
    expect(euclideanDistance(a, b)).toBe(3)
  })

  it('calcula la distancia correcta en el eje Z', () => {
    const a = new THREE.Vector3(0, 0, 0)
    const b = new THREE.Vector3(0, 0, 4)
    expect(euclideanDistance(a, b)).toBe(4)
  })

  it('calcula la distancia euclidiana 3D correctamente (3-4-5 en 3D)', () => {
    // sqrt(3² + 4²) = 5
    const a = new THREE.Vector3(0, 0, 0)
    const b = new THREE.Vector3(3, 4, 0)
    expect(euclideanDistance(a, b)).toBe(5)
  })

  it('redondea a 2 decimales', () => {
    // sqrt(1² + 1² + 1²) = sqrt(3) ≈ 1.732...
    const a = new THREE.Vector3(0, 0, 0)
    const b = new THREE.Vector3(1, 1, 1)
    const result = euclideanDistance(a, b)
    expect(result).toBe(parseFloat(Math.sqrt(3).toFixed(2)))
  })

  it('es simétrica: dist(a, b) === dist(b, a)', () => {
    const a = new THREE.Vector3(1, 2, 3)
    const b = new THREE.Vector3(4, 6, 3)
    expect(euclideanDistance(a, b)).toBe(euclideanDistance(b, a))
  })

  it('devuelve un número con máximo 2 decimales', () => {
    const a = new THREE.Vector3(0, 0, 0)
    const b = new THREE.Vector3(1, 2, 3)
    const result = euclideanDistance(a, b)
    const decimals = (result.toString().split('.')[1] ?? '').length
    expect(decimals).toBeLessThanOrEqual(2)
  })
})
