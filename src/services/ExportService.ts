import type { MeasurementLine, RoomDimensions } from '../types'

/**
 * Servicio de exportación de mediciones.
 * Genera archivos JSON y CSV a partir de las MeasurementLines activas
 * y dispara la descarga en el navegador.
 */
export const ExportService = {
  /**
   * Genera un JSON con las mediciones activas y las dimensiones de la habitación.
   * Si `lines` está vacío, devuelve una cadena vacía (sin datos que exportar).
   *
   * Formato:
   * {
   *   "exportedAt": "<ISO timestamp>",
   *   "roomDimensions": { "width": ..., "height": ..., "depth": ... },
   *   "measurements": [
   *     { "id": "m_1", "pointA": { "x": 0, "y": 0, "z": 0 }, "pointB": { "x": 5, "y": 0, "z": 0 }, "distance": 5.00 }
   *   ]
   * }
   */
  toJSON(lines: MeasurementLine[], dims: RoomDimensions): string {
    if (lines.length === 0) return ''

    const measurements = lines.map((line) => ({
      id: line.id,
      pointA: {
        x: line.anchorA.position.x,
        y: line.anchorA.position.y,
        z: line.anchorA.position.z,
      },
      pointB: {
        x: line.anchorB.position.x,
        y: line.anchorB.position.y,
        z: line.anchorB.position.z,
      },
      distance: line.distance,
    }))

    const payload = {
      exportedAt: new Date().toISOString(),
      roomDimensions: {
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
      },
      measurements,
    }

    return JSON.stringify(payload, null, 2)
  },

  /**
   * Genera un CSV con las mediciones activas.
   * Si `lines` está vacío, devuelve una cadena vacía (sin datos que exportar).
   *
   * Cabecera: id,x1,y1,z1,x2,y2,z2,distance_m
   */
  toCSV(lines: MeasurementLine[]): string {
    if (lines.length === 0) return ''

    const header = 'id,x1,y1,z1,x2,y2,z2,distance_m'
    const rows = lines.map((line) => {
      const { x: x1, y: y1, z: z1 } = line.anchorA.position
      const { x: x2, y: y2, z: z2 } = line.anchorB.position
      return `${line.id},${x1},${y1},${z1},${x2},${y2},${z2},${line.distance}`
    })

    return [header, ...rows].join('\n')
  },

  /**
   * Crea un Blob con el contenido dado y dispara la descarga
   * mediante un enlace <a> temporal que se elimina tras el clic.
   */
  download(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'

    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)

    URL.revokeObjectURL(url)
  },
}
