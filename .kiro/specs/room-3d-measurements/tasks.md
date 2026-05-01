# Plan de Implementación: Medición de Estancias en 3D

## Visión general

Implementación incremental de una SPA (Single Page Application) en TypeScript + Three.js + Vite que permite visualizar una habitación en 3D, tomar medidas entre puntos, ver dimensiones principales y exportar/persistir la sesión. Cada tarea construye sobre la anterior y termina con la integración de todos los componentes.

## Tareas

- [x] 1. Inicializar el proyecto y la estructura base
  - Crear proyecto Vite con plantilla TypeScript (`npm create vite@latest room-3d-measurements -- --template vanilla-ts`)
  - Instalar dependencias: `three`, `@types/three`, `vitest`, `@vitest/coverage-v8`, `fast-check`, `@testing-library/dom`
  - Configurar `vitest.config.ts` con entorno jsdom y cobertura de líneas ≥ 90 % para módulos de dominio puro
  - Crear estructura de directorios: `src/domain/`, `src/viewer/`, `src/tools/`, `src/services/`, `src/ui/`, `src/store/`
  - Definir todos los tipos e interfaces TypeScript en `src/types.ts` (`RoomDimensions`, `AnchorPoint`, `MeasurementLine`, `SerializedMeasurementLine`, `SessionData`, `SnapPoint`, `ExportRecord`, `DimensionValidationResult`)
  - _Requisitos: 1.1, 1.5, 3.1, 3.2, 5.1, 5.2, 6.1_

- [x] 2. Implementar la lógica de dominio pura
  - [x] 2.1 Implementar `validateDimension` en `src/domain/validation.ts`
    - Devuelve `{ valid: false, error: 'non-positive' }` para valores ≤ 0 o NaN
    - Devuelve `{ valid: false, error: 'out-of-range' }` para valores > 100
    - Devuelve `{ valid: true }` para valores en (0, 100]
    - _Requisitos: 1.3, 1.4_

  - [ ]* 2.2 Escribir property test para `validateDimension` (Property 2)
    - **Property 2: Validación comprehensiva de dimensiones inválidas**
    - **Valida: Requisitos 1.3, 1.4**
    - Usar `fc.float()` con filtros para cubrir los tres rangos: ≤ 0, (0, 100], > 100
    - Mínimo 100 iteraciones

  - [x] 2.3 Implementar `euclideanDistance` en `src/domain/geometry.ts`
    - Recibe dos `THREE.Vector3` y devuelve `parseFloat(a.distanceTo(b).toFixed(2))`
    - _Requisitos: 3.2, 3.3_

  - [ ]* 2.4 Escribir property test para `euclideanDistance` (Property 4)
    - **Property 4: Cálculo correcto de distancia euclidiana con precisión de dos decimales**
    - **Valida: Requisitos 3.2, 3.3**
    - Usar `fc.record({ x: fc.float(), y: fc.float(), z: fc.float() })` × 2
    - Verificar que el resultado coincide con la fórmula manual y tiene exactamente dos decimales
    - Mínimo 100 iteraciones

- [x] 3. Checkpoint — Verificar dominio puro
  - Asegurarse de que todos los tests pasan. Consultar al usuario si surgen dudas.

- [x] 4. Implementar `SessionStore` en `src/store/SessionStore.ts`
  - [x] 4.1 Implementar `save`, `load` y `clear` sobre `localStorage` con clave `room3d_session`
    - `save(data)`: serializa a JSON y escribe en `localStorage`; captura excepciones y emite evento `session:save-failed`
    - `load()`: lee y parsea JSON; devuelve `null` si no existe, si el JSON es inválido o no cumple el esquema
    - `clear()`: elimina la clave de `localStorage`
    - _Requisitos: 6.1, 6.2, 6.3_

  - [ ]* 4.2 Escribir property test para `SessionStore` (Property 10)
    - **Property 10: Round-trip de persistencia en localStorage**
    - **Valida: Requisitos 6.1, 6.2**
    - Usar `fc.record` con dimensiones válidas y array de mediciones serializadas
    - Verificar que `load()` tras `save(data)` devuelve los mismos valores
    - Mínimo 100 iteraciones

  - [ ]* 4.3 Escribir unit tests para `SessionStore`
    - Verificar que `clear()` hace que `load()` devuelva `null` (Req. 6.3)
    - Verificar comportamiento con `localStorage` no disponible (excepción capturada, evento emitido)
    - Verificar que datos corruptos en `localStorage` devuelven `null`

- [x] 5. Implementar `ExportService` en `src/services/ExportService.ts`
  - [x] 5.1 Implementar `toJSON`, `toCSV` y `download`
    - `toJSON(lines)`: genera JSON con `exportedAt`, `roomDimensions` y array de mediciones con `pointA`, `pointB` y `distance`
    - `toCSV(lines)`: genera CSV con cabecera `id,x1,y1,z1,x2,y2,z2,distance_m` y una fila por línea
    - `download(content, filename, mimeType)`: crea un `Blob` y dispara la descarga mediante un enlace temporal
    - _Requisitos: 5.1, 5.2, 5.3_

  - [ ]* 5.2 Escribir property test para `toJSON` (Property 8)
    - **Property 8: Round-trip de exportación JSON**
    - **Valida: Requisito 5.1**
    - Usar `fc.array(fc.record(measurementLineArbitrary), { minLength: 1 })`
    - Verificar que el JSON es parseable y cada línea conserva coordenadas y distancia
    - Mínimo 100 iteraciones

  - [ ]* 5.3 Escribir property test para `toCSV` (Property 9)
    - **Property 9: Round-trip de exportación CSV**
    - **Valida: Requisito 5.2**
    - Verificar que el CSV tiene exactamente N+1 líneas para N mediciones
    - Verificar que cada fila contiene id, seis coordenadas y distancia
    - Mínimo 100 iteraciones

  - [ ]* 5.4 Escribir unit test para exportación con lista vacía
    - Verificar que `toJSON([])` y `toCSV([])` no generan archivo y se emite el aviso informativo (Req. 5.3)

- [x] 6. Checkpoint — Verificar servicios y store
  - Asegurarse de que todos los tests pasan. Consultar al usuario si surgen dudas.

- [x] 7. Implementar `SnapPointCalculator` en `src/tools/SnapPointCalculator.ts`
  - [x] 7.1 Implementar `compute(dims)` y `findNearest(...)`
    - `compute(dims)`: calcula las 8 esquinas, 12 centros de aristas y 6 centros de cara de la habitación
    - `findNearest(candidate, camera, renderer, thresholdPx)`: proyecta cada snap point a espacio de pantalla y devuelve el más cercano si está a < 10 px, o `null`
    - _Requisitos: 3.4_

  - [ ]* 7.2 Escribir property test para `findNearest` (Property 5)
    - **Property 5: Umbral de snap point**
    - **Valida: Requisito 3.4**
    - Verificar que `findNearest` devuelve el snap más cercano si y solo si su distancia en pantalla es estrictamente < 10 px
    - Usar mocks de cámara y renderer para controlar la proyección
    - Mínimo 100 iteraciones

- [x] 8. Implementar `Room_Viewer` en `src/viewer/RoomViewer.ts`
  - [x] 8.1 Crear la escena Three.js con `WebGLRenderer` y `CSS2DRenderer`
    - Inicializar `THREE.Scene`, `THREE.PerspectiveCamera`, `THREE.WebGLRenderer` y `CSS2DRenderer`
    - Configurar `OrbitControls` con `enableRotate`, `enableZoom` y `enablePan` en `true`
    - Añadir `AmbientLight` y `DirectionalLight` para iluminación básica
    - Manejar `window.resize` para redimensionar ambos renderers y actualizar el aspect ratio de la cámara
    - _Requisitos: 2.1, 2.2, 2.3, 2.5_

  - [x] 8.2 Implementar `setDimensions` y `getSurfaceMeshes`
    - Crear seis `THREE.PlaneGeometry` con `THREE.MeshStandardMaterial` de colores diferenciados
    - Asignar `userData.surfaceType` a cada mesh: `'floor'`, `'ceiling'`, `'wall-north'`, `'wall-south'`, `'wall-east'`, `'wall-west'`
    - `setDimensions` reconstruye la geometría y actualiza las etiquetas permanentes
    - `getDimensions` devuelve las dimensiones actuales
    - _Requisitos: 1.1, 1.2, 1.5_

  - [ ]* 8.3 Escribir property test para round-trip de dimensiones (Property 1)
    - **Property 1: Round-trip de dimensiones**
    - **Valida: Requisitos 1.1, 1.2**
    - Usar `fc.float({ min: 0.01, max: 100 })` × 3 para generar dimensiones válidas
    - Verificar que `getDimensions()` tras `setDimensions(dims)` devuelve los mismos valores
    - Mínimo 100 iteraciones

  - [ ]* 8.4 Escribir property test para seis superficies (Property 3)
    - **Property 3: Seis superficies siempre presentes**
    - **Valida: Requisito 1.5**
    - Verificar que `getSurfaceMeshes()` devuelve exactamente 6 meshes para cualquier dimensión válida
    - Mínimo 100 iteraciones

  - [x] 8.5 Implementar etiquetas permanentes de dimensiones con `CSS2DObject`
    - Crear tres `CSS2DObject` con clase CSS `permanent-label` posicionados sobre las aristas de ancho, alto y largo
    - `updatePermanentLabels()` actualiza el texto de cada etiqueta con los valores actuales
    - _Requisitos: 4.1, 4.2, 4.3_

  - [ ]* 8.6 Escribir property test para etiquetas permanentes (Property 7)
    - **Property 7: Etiquetas permanentes reflejan las dimensiones actuales**
    - **Valida: Requisitos 4.1, 4.2**
    - Verificar que tras `setDimensions(dims)` las tres etiquetas muestran exactamente `width`, `height` y `depth`
    - Mínimo 100 iteraciones

  - [x] 8.7 Implementar animación de doble clic para vista frontal
    - Listener de `dblclick` sobre el canvas que detecta la superficie clicada mediante raycasting
    - Animar la cámara hasta una vista frontal centrada en esa superficie en ≤ 500 ms usando `gsap` o `TWEEN.js`
    - _Requisitos: 2.4_

  - [ ]* 8.8 Escribir unit test para animación de cámara
    - Mockear `gsap`/`TWEEN.js` y verificar que la duración configurada es ≤ 500 ms (Req. 2.4)

- [x] 9. Checkpoint — Verificar Room_Viewer
  - Asegurarse de que todos los tests pasan. Consultar al usuario si surgen dudas.

- [x] 10. Implementar `Measurement_Tool` en `src/tools/MeasurementTool.ts`
  - [x] 10.1 Implementar `setActive`, `handlePointerDown` y `handlePointerMove`
    - `handlePointerDown`: construye un `Raycaster` desde la cámara, intersecta los meshes de `getSurfaceMeshes()`, aplica snap si procede y coloca un `AnchorPoint` (esfera `THREE.SphereGeometry`)
    - Al colocar el segundo anchor, calcula la distancia con `euclideanDistance`, crea la `MeasurementLine` (`THREE.BufferGeometry` + `THREE.LineBasicMaterial`) y añade un `CSS2DObject` con clase `measurement-label`
    - `handlePointerMove`: actualiza el snap visual más cercano resaltándolo
    - _Requisitos: 3.1, 3.2, 3.3, 3.4_

  - [x] 10.2 Implementar `deleteLine`, `getLines` y `restoreLines`
    - `deleteLine(id)`: elimina la línea y sus anchors de la escena y del array interno
    - Listener de `keydown` para `Delete`/`Supr` sobre la línea seleccionada (selección por raycasting sobre meshes de línea)
    - `restoreLines(data)`: reconstruye las `MeasurementLine`s desde datos serializados
    - _Requisitos: 3.5, 3.6_

  - [ ]* 10.3 Escribir property test para invariante de colección (Property 6)
    - **Property 6: Invariante de colección de mediciones**
    - **Valida: Requisitos 3.5, 3.6**
    - Usar `fc.array(fc.record(pairOfPoints), { minLength: 1 })` para generar secuencias de adiciones
    - Verificar que `getLines().length === N` tras N adiciones
    - Verificar que tras `deleteLine(id)` la colección no contiene esa id y tiene longitud N-1
    - Mínimo 100 iteraciones

  - [ ]* 10.4 Escribir unit tests para `Measurement_Tool`
    - Verificar que un clic fuera de cualquier superficie no coloca anchor (Req. 3.1)
    - Verificar diferenciación visual: etiquetas de medición tienen clase `measurement-label`, no `permanent-label` (Req. 4.3)

- [x] 11. Implementar `AppController` en `src/AppController.ts`
  - Orquestar `RoomViewer`, `MeasurementTool`, `SessionStore` y `ExportService`
  - `setRoomDimensions(dims)`: valida con `validateDimension`, llama a `RoomViewer.setDimensions()` y `SessionStore.save()`
  - `activateMeasurementTool()` / `deactivateMeasurementTool()`: delega en `MeasurementTool.setActive()`
  - `exportJSON()` / `exportCSV()`: obtiene líneas de `MeasurementTool.getLines()` y delega en `ExportService`
  - `resetSession()`: llama a `SessionStore.clear()` y carga la configuración por defecto (5 × 3 × 2,5 m)
  - Al inicializar: intenta `SessionStore.load()` y restaura el estado si existe
  - _Requisitos: 1.2, 6.1, 6.2, 6.3_

- [x] 12. Implementar la capa UI en `src/ui/`
  - [x] 12.1 Crear `DimensionForm` en `src/ui/DimensionForm.ts`
    - Formulario HTML con tres inputs numéricos (ancho, alto, largo) y validación en tiempo real
    - Muestra mensaje de error para valores ≤ 0 (Req. 1.3) y diálogo de confirmación para valores > 100 (Req. 1.4)
    - Llama a `AppController.setRoomDimensions()` en cada cambio válido
    - _Requisitos: 1.2, 1.3, 1.4_

  - [x] 12.2 Crear `ToolbarPanel` en `src/ui/ToolbarPanel.ts`
    - Botón para activar/desactivar la `Measurement_Tool` con estado visual (activo/inactivo)
    - Botón de reset de sesión que llama a `AppController.resetSession()`
    - _Requisitos: 3.1, 6.3_

  - [x] 12.3 Crear `ExportButton` en `src/ui/ExportButton.ts`
    - Botones "Exportar JSON" y "Exportar CSV" que llaman a `AppController.exportJSON()` / `exportCSV()`
    - Muestra mensaje informativo si no hay mediciones activas (Req. 5.3)
    - _Requisitos: 5.1, 5.2, 5.3_

  - [x] 12.4 Añadir estilos CSS en `src/styles.css`
    - Estilos diferenciados para `.permanent-label` (tipografía/color distintos) y `.measurement-label`
    - Layout básico: canvas a pantalla completa, controles superpuestos en panel lateral
    - _Requisitos: 4.3_

- [x] 13. Checkpoint — Verificar integración completa
  - Asegurarse de que todos los tests pasan. Consultar al usuario si surgen dudas.

- [x] 14. Cablear todos los componentes en `src/main.ts`
  - Instanciar `AppController` y montar los componentes UI sobre el DOM
  - Conectar el canvas del `RoomViewer` al contenedor principal
  - Registrar los listeners de teclado globales (`Delete`/`Supr`) para eliminación de líneas
  - Verificar que la restauración de sesión funciona al cargar la página (Req. 6.2)
  - Verificar que la configuración por defecto (5 × 3 × 2,5 m) se carga cuando no hay sesión (Req. 6.3)
  - _Requisitos: 1.1, 2.1, 3.6, 6.1, 6.2, 6.3_

  - [ ]* 14.1 Escribir tests de smoke
    - Verificar que `OrbitControls` tiene `enableRotate`, `enableZoom` y `enablePan` en `true` (Req. 2.1, 2.2, 2.3)
    - Verificar que la configuración por defecto carga habitación 5 × 3 × 2,5 m cuando no hay sesión guardada

- [x] 15. Checkpoint final — Verificar suite completa
  - Ejecutar `vitest --run --coverage` y confirmar que todos los tests pasan y la cobertura de dominio puro es ≥ 90 %
  - Asegurarse de que no hay código huérfano sin integrar. Consultar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints garantizan validación incremental en cada fase
- Los property tests validan invariantes universales con fast-check (mínimo 100 iteraciones cada uno)
- Los unit tests validan comportamientos específicos y casos límite
- El lenguaje de implementación es **TypeScript** con **Three.js r165+** y **Vite** como bundler
