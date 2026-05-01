# Documento de Diseño Técnico: Medición de Estancias en 3D

## Resumen de Investigación

Las tecnologías seleccionadas se basan en el ecosistema estándar de Three.js para aplicaciones 3D en el navegador:

- **[Three.js](https://threejs.org/)** (r165+): biblioteca WebGL de referencia para renderizado 3D en el navegador. Proporciona geometrías, materiales, cámara, raycasting y controles de órbita listos para usar.
- **CSS2DRenderer**: módulo de Three.js que superpone elementos HTML sobre el canvas WebGL, ideal para etiquetas de dimensiones que deben permanecer legibles independientemente del zoom.
- **OrbitControls**: addon de Three.js que implementa rotación orbital, zoom y pan con soporte para ratón y pantalla táctil.
- **`THREE.Raycaster`**: API nativa de Three.js para proyectar rayos desde la cámara y detectar intersecciones con geometría 3D, base del sistema de medición.
- **[fast-check](https://fast-check.dev/)** (v4.x): framework de property-based testing para JavaScript/TypeScript, compatible con Vitest y Jest.

---

## Overview

La aplicación es una herramienta web de visualización y medición de estancias en 3D. El usuario define las dimensiones de una habitación (ancho, alto, largo) y obtiene un modelo 3D navegable con paredes, suelo y techo. Sobre ese modelo puede colocar puntos de anclaje en cualquier superficie para medir distancias euclidianas arbitrarias, ver las dimensiones principales de la habitación como etiquetas permanentes, y exportar todas las medidas a JSON o CSV. La sesión se persiste automáticamente en `localStorage`.

La aplicación es una SPA (Single Page Application) sin backend, ejecutada íntegramente en el navegador. El stack es TypeScript + Three.js + Vite.

---

## Architecture

La arquitectura sigue un patrón de capas con separación clara entre estado, lógica de dominio y presentación:

```
┌─────────────────────────────────────────────────────────┐
│                        UI Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  DimensionForm│  │ToolbarPanel  │  │ ExportButton  │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ eventos DOM
┌────────────────────────▼────────────────────────────────┐
│                   Application Layer                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │              AppController                       │   │
│  │  (orquesta Room_Viewer, Measurement_Tool,        │   │
│  │   SessionStore y ExportService)                  │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│  Room_Viewer │ │Measurement_  │ │  SessionStore    │
│  (Three.js)  │ │Tool          │ │  (localStorage)  │
└──────┬───────┘ └──────┬───────┘ └──────────────────┘
       │                │
       ▼                ▼
┌──────────────────────────────┐
│       SceneGraph             │
│  Scene / Camera / Renderers  │
│  RoomGeometry / Labels       │
│  MeasurementLines / Anchors  │
└──────────────────────────────┘
```

**Flujo de datos principal:**

1. El usuario introduce dimensiones → `DimensionForm` → `AppController.setRoomDimensions()` → `Room_Viewer.rebuild()` + `SessionStore.save()`.
2. El usuario activa la herramienta de medición → `AppController.activateMeasurementTool()` → `Measurement_Tool` escucha eventos de ratón.
3. Clic sobre superficie → `Raycaster` detecta intersección → `Measurement_Tool.placeAnchor()` → si hay dos puntos, crea `MeasurementLine` + `Dimension_Label` → `SessionStore.save()`.
4. Exportación → `ExportService.toJSON()` / `ExportService.toCSV()` → descarga de archivo.

---

## Components and Interfaces

### Room_Viewer

Responsable de construir y renderizar la geometría de la habitación y las etiquetas permanentes de dimensiones.

```typescript
interface RoomDimensions {
  width: number;   // metros, (0, 100]
  height: number;  // metros, (0, 100]
  depth: number;   // metros, (0, 100]
}

interface RoomViewer {
  /** Construye o reconstruye la geometría a partir de las dimensiones dadas. */
  setDimensions(dims: RoomDimensions): void;

  /** Devuelve las dimensiones actuales. */
  getDimensions(): RoomDimensions;

  /** Devuelve los meshes de las seis superficies para raycasting. */
  getSurfaceMeshes(): THREE.Mesh[];

  /** Actualiza las Dimension_Labels permanentes. */
  updatePermanentLabels(): void;

  /** Inicia el bucle de renderizado. */
  start(): void;

  /** Detiene el bucle de renderizado y libera recursos. */
  dispose(): void;
}
```

**Implementación de superficies:** seis `THREE.PlaneGeometry` con `THREE.MeshStandardMaterial` de colores diferenciados (suelo: gris claro, techo: blanco, paredes: tonos neutros). Cada mesh tiene `userData.surfaceType` para identificación.

**Cámara y controles:** `THREE.PerspectiveCamera` con `OrbitControls`. El doble clic sobre una superficie anima la cámara con `TWEEN.js` (o `gsap`) hasta una vista frontal en ≤ 500 ms.

**Renderers:** `THREE.WebGLRenderer` (escena 3D) + `CSS2DRenderer` (etiquetas HTML superpuestas), ambos redimensionados en `window.resize`.

---

### Measurement_Tool

Gestiona la colocación de `Anchor_Points`, el cálculo de distancias y el ciclo de vida de las `Measurement_Lines`.

```typescript
interface AnchorPoint {
  id: string;
  position: THREE.Vector3;  // coordenadas mundo
  mesh: THREE.Mesh;         // esfera visual
}

interface MeasurementLine {
  id: string;
  anchorA: AnchorPoint;
  anchorB: AnchorPoint;
  distance: number;         // metros, 2 decimales
  lineMesh: THREE.Line;
  label: CSS2DObject;
}

interface MeasurementTool {
  /** Activa/desactiva la herramienta. */
  setActive(active: boolean): void;

  /** Procesa un evento de clic: coloca anchor o completa medición. */
  handlePointerDown(event: PointerEvent): void;

  /** Actualiza el snap visual durante el movimiento del cursor. */
  handlePointerMove(event: PointerEvent): void;

  /** Elimina la MeasurementLine con el id dado. */
  deleteLine(id: string): void;

  /** Devuelve todas las MeasurementLines activas. */
  getLines(): MeasurementLine[];

  /** Restaura líneas desde datos serializados. */
  restoreLines(data: SerializedMeasurementLine[]): void;
}
```

**Raycasting:** en cada evento de puntero se construye un `THREE.Raycaster` desde la cámara hacia las coordenadas normalizadas del ratón. Se intersectan los meshes de `Room_Viewer.getSurfaceMeshes()`. El primer hit determina la posición del anchor.

**Snap:** antes de confirmar la posición, se comprueba si algún `SnapPoint` (esquinas y centros de aristas precalculados) está a menos de 10 px en espacio de pantalla. Si es así, la posición se sustituye por la del snap.

**Línea visual:** `THREE.BufferGeometry` con `THREE.LineBasicMaterial`. La etiqueta de distancia es un `CSS2DObject` con clase CSS `measurement-label` (estilo diferenciado de las etiquetas permanentes).

**Eliminación:** listener de `keydown` con `Delete`/`Supr` sobre la línea seleccionada (selección por raycasting sobre los meshes de línea).

---

### SnapPointCalculator

Calcula los puntos de ajuste automático a partir de las dimensiones de la habitación.

```typescript
interface SnapPoint {
  position: THREE.Vector3;
  type: 'corner' | 'edge-center' | 'face-center';
}

interface SnapPointCalculator {
  /** Recalcula los snap points cuando cambian las dimensiones. */
  compute(dims: RoomDimensions): SnapPoint[];

  /**
   * Dado un punto 3D candidato y la cámara actual,
   * devuelve el SnapPoint más cercano en pantalla si está a < 10 px,
   * o null si ninguno cumple el umbral.
   */
  findNearest(
    candidate: THREE.Vector3,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    thresholdPx: number
  ): SnapPoint | null;
}
```

---

### ExportService

Genera los archivos de exportación sin dependencias externas.

```typescript
interface ExportRecord {
  id: string;
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
  distance: number;
}

interface ExportService {
  toJSON(lines: MeasurementLine[]): string;
  toCSV(lines: MeasurementLine[]): string;
  /** Dispara la descarga del archivo en el navegador. */
  download(content: string, filename: string, mimeType: string): void;
}
```

---

### SessionStore

Abstrae el acceso a `localStorage`.

```typescript
interface SessionData {
  roomDimensions: RoomDimensions;
  measurements: SerializedMeasurementLine[];
}

interface SerializedMeasurementLine {
  id: string;
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  distance: number;
}

interface SessionStore {
  save(data: SessionData): void;
  load(): SessionData | null;
  clear(): void;
}
```

---

## Data Models

### RoomModel (estado central)

```typescript
interface RoomModel {
  dimensions: RoomDimensions;
  measurements: MeasurementLine[];
}
```

### Validación de dimensiones

```typescript
type DimensionValidationResult =
  | { valid: true }
  | { valid: false; error: 'non-positive' | 'out-of-range' };

function validateDimension(value: number): DimensionValidationResult {
  if (value <= 0) return { valid: false, error: 'non-positive' };
  if (value > 100) return { valid: false, error: 'out-of-range' };
  return { valid: true };
}
```

### Cálculo de distancia euclidiana

```typescript
function euclideanDistance(a: THREE.Vector3, b: THREE.Vector3): number {
  return parseFloat(a.distanceTo(b).toFixed(2));
}
```

### Serialización de sesión

El formato almacenado en `localStorage` bajo la clave `room3d_session`:

```json
{
  "roomDimensions": { "width": 5, "height": 2.5, "depth": 3 },
  "measurements": [
    {
      "id": "m_1",
      "ax": 0, "ay": 0, "az": 0,
      "bx": 5, "by": 0, "bz": 0,
      "distance": 5.00
    }
  ]
}
```

### Formato de exportación JSON

```json
{
  "exportedAt": "2024-01-15T10:30:00Z",
  "roomDimensions": { "width": 5, "height": 2.5, "depth": 3 },
  "measurements": [
    {
      "id": "m_1",
      "pointA": { "x": 0, "y": 0, "z": 0 },
      "pointB": { "x": 5, "y": 0, "z": 0 },
      "distance": 5.00
    }
  ]
}
```

### Formato de exportación CSV

```
id,x1,y1,z1,x2,y2,z2,distance_m
m_1,0,0,0,5,0,0,5.00
m_2,0,0,0,0,2.5,0,2.50
```

---

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas del sistema — esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de corrección verificables por máquina.*


### Property 1: Round-trip de dimensiones

*Para cualquier* tripleta de dimensiones válidas (width, height, depth) con valores en el rango (0, 100], llamar a `setDimensions(dims)` seguido de `getDimensions()` debe devolver un objeto con los mismos valores.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: Validación comprehensiva de dimensiones inválidas

*Para cualquier* valor numérico `v`, si `v ≤ 0` entonces `validateDimension(v)` debe devolver `{ valid: false, error: 'non-positive' }`, y si `v > 100` entonces debe devolver `{ valid: false, error: 'out-of-range' }`. Para cualquier `v` en el rango `(0, 100]`, debe devolver `{ valid: true }`.

**Validates: Requirements 1.3, 1.4**

---

### Property 3: Seis superficies siempre presentes

*Para cualquier* tripleta de dimensiones válidas, `getSurfaceMeshes()` debe devolver exactamente 6 meshes, uno por cada superficie de la habitación (suelo, techo, pared norte, pared sur, pared este, pared oeste).

**Validates: Requirements 1.5**

---

### Property 4: Cálculo correcto de distancia euclidiana con precisión de dos decimales

*Para cualquier* par de puntos 3D `a` y `b`, `euclideanDistance(a, b)` debe ser igual a `parseFloat(Math.sqrt((b.x-a.x)² + (b.y-a.y)² + (b.z-a.z)²).toFixed(2))`, y el resultado debe tener exactamente dos decimales en su representación de cadena.

**Validates: Requirements 3.2, 3.3**

---

### Property 5: Umbral de snap point

*Para cualquier* posición de cursor y conjunto de snap points, `findNearest()` debe devolver el snap point más cercano si y solo si su distancia en espacio de pantalla es estrictamente menor que 10 píxeles; en caso contrario debe devolver `null`.

**Validates: Requirements 3.4**

---

### Property 6: Invariante de colección de mediciones

*Para cualquier* conjunto de N pares de puntos válidos añadidos secuencialmente, `getLines().length` debe ser igual a N. Tras eliminar una línea con id `k`, `getLines()` no debe contener ninguna línea con ese id y `getLines().length` debe ser N-1.

**Validates: Requirements 3.5, 3.6**

---

### Property 7: Etiquetas permanentes reflejan las dimensiones actuales

*Para cualquier* tripleta de dimensiones válidas establecida mediante `setDimensions()`, las tres etiquetas permanentes deben mostrar exactamente los valores de `width`, `height` y `depth` de esas dimensiones.

**Validates: Requirements 4.1, 4.2**

---

### Property 8: Round-trip de exportación JSON

*Para cualquier* conjunto no vacío de `MeasurementLine`s, el JSON generado por `toJSON(lines)` debe ser parseable como JSON válido y, al deserializarlo, cada línea debe contener las coordenadas de sus dos anchor points y la distancia calculada con los mismos valores que el objeto original.

**Validates: Requirements 5.1**

---

### Property 9: Round-trip de exportación CSV

*Para cualquier* conjunto no vacío de `MeasurementLine`s de tamaño N, el CSV generado por `toCSV(lines)` debe tener exactamente N+1 líneas (1 cabecera + N filas de datos), y cada fila de datos debe contener el id, las seis coordenadas y la distancia de la línea correspondiente.

**Validates: Requirements 5.2**

---

### Property 10: Round-trip de persistencia en localStorage

*Para cualquier* `SessionData` válido (dimensiones + mediciones), llamar a `save(data)` seguido de `load()` debe devolver un objeto con los mismos valores de dimensiones y el mismo conjunto de mediciones serializadas.

**Validates: Requirements 6.1, 6.2**

---

## Error Handling

### Validación de dimensiones

| Condición | Comportamiento |
|-----------|---------------|
| Valor ≤ 0 | `validateDimension` devuelve `non-positive`; la UI muestra mensaje de error y no aplica el cambio |
| Valor > 100 | `validateDimension` devuelve `out-of-range`; la UI muestra aviso de confirmación antes de aplicar |
| Valor no numérico / NaN | Tratado como `non-positive`; la UI muestra mensaje de error |

### Raycasting sin intersección

Si el usuario hace clic fuera de cualquier superficie (p. ej., en el fondo de la escena), `handlePointerDown` no coloca ningún anchor. No se muestra error; el cursor simplemente no reacciona.

### Exportación sin mediciones

Si `getLines()` devuelve un array vacío al solicitar exportación, `ExportService` no genera archivo y la UI muestra el mensaje informativo del Requisito 5.3.

### localStorage no disponible

Si `localStorage` no está disponible (modo privado estricto, cuota excedida), `SessionStore.save()` captura la excepción y emite un evento `session:save-failed` que la UI puede mostrar como aviso no bloqueante. La aplicación continúa funcionando en memoria.

### Restauración de sesión corrupta

Si los datos en `localStorage` no son JSON válido o no cumplen el esquema de `SessionData`, `SessionStore.load()` devuelve `null` y la aplicación carga la configuración por defecto (5 × 3 × 2,5 m, sin mediciones).

---

## Testing Strategy

### Enfoque dual

La estrategia combina tests de ejemplo (unit tests) para comportamientos específicos y tests de propiedades (property-based tests) para invariantes universales.

**Herramientas:**
- **Vitest** como test runner (compatible con proyectos Vite/TypeScript)
- **fast-check** (v4.x) para property-based testing
- **@testing-library/dom** para tests de integración de UI ligeros

### Tests de propiedades (property-based)

Cada propiedad del documento se implementa como un test de fast-check con mínimo **100 iteraciones**. Cada test lleva un comentario de trazabilidad:

```typescript
// Feature: room-3d-measurements, Property 4: Cálculo correcto de distancia euclidiana
fc.assert(
  fc.property(
    fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
    fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
    (a, b) => {
      const result = euclideanDistance(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z));
      const expected = parseFloat(Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2 + (b.z-a.z)**2).toFixed(2));
      return result === expected;
    }
  ),
  { numRuns: 100 }
);
```

**Propiedades a cubrir con PBT:**

| Property | Módulo bajo test | Arbitrarios fast-check |
|----------|-----------------|------------------------|
| P1 Round-trip dimensiones | `RoomViewer` | `fc.float({ min: 0.01, max: 100 })` × 3 |
| P2 Validación dimensiones | `validateDimension` | `fc.float()` con filtros |
| P3 Seis superficies | `RoomViewer` | dimensiones válidas |
| P4 Distancia euclidiana | `euclideanDistance` | `fc.record({ x, y, z: fc.float() })` × 2 |
| P5 Snap threshold | `SnapPointCalculator` | posiciones de pantalla + snap points |
| P6 Invariante colección | `MeasurementTool` | `fc.array(pairOfPoints, { minLength: 1 })` |
| P7 Etiquetas permanentes | `RoomViewer` | dimensiones válidas |
| P8 Round-trip JSON | `ExportService` | `fc.array(measurementLine, { minLength: 1 })` |
| P9 Round-trip CSV | `ExportService` | `fc.array(measurementLine, { minLength: 1 })` |
| P10 Round-trip localStorage | `SessionStore` | `fc.record(sessionData)` |

### Tests de ejemplo (unit tests)

- **Doble clic → animación de cámara ≤ 500 ms** (Req. 2.4): mock de TWEEN/gsap, verificar duración configurada.
- **Diferenciación visual de etiquetas** (Req. 4.3): verificar que las etiquetas permanentes tienen clase CSS `permanent-label` y las de medición tienen `measurement-label`.
- **Exportación con lista vacía** (Req. 5.3): verificar que `ExportService` no genera archivo y se emite el evento de aviso.
- **Reset de sesión** (Req. 6.3): llamar a `clear()`, verificar que `load()` devuelve `null`.

### Tests de smoke

- OrbitControls configurado con `enableRotate`, `enableZoom`, `enablePan` en `true` (Req. 2.1, 2.2, 2.3).
- Configuración por defecto carga habitación 5 × 3 × 2,5 m cuando no hay sesión guardada.

### Cobertura objetivo

- Lógica de dominio pura (`validateDimension`, `euclideanDistance`, `ExportService`, `SessionStore`): ≥ 90 % de cobertura de líneas.
- Integración Three.js (`RoomViewer`, `MeasurementTool`): tests con mocks de WebGL renderer; cobertura de ramas principales.
- UI: tests de smoke para verificar que los componentes se montan sin errores.
