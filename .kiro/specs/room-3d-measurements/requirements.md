# Documento de Requisitos

## Introducción

Esta aplicación permite al usuario visualizar una habitación en un entorno 3D interactivo (con paredes, suelo y techo) y tomar medidas precisas de sus dimensiones: ancho, alto, largo, y distancias arbitrarias entre puntos del espacio. El objetivo es facilitar la planificación de espacios interiores, reformas o amueblamiento sin necesidad de herramientas físicas de medición.

## Glosario

- **Room_Viewer**: Componente 3D que renderiza la habitación con sus superficies (suelo, techo, paredes).
- **Measurement_Tool**: Herramienta que permite al usuario seleccionar puntos en el espacio 3D y calcular distancias.
- **Anchor_Point**: Punto seleccionado por el usuario sobre una superficie 3D para iniciar o terminar una medición.
- **Measurement_Line**: Línea visual que conecta dos Anchor_Points y muestra la distancia calculada.
- **Room_Model**: Estructura de datos que representa las dimensiones y geometría de la habitación (ancho, alto, largo).
- **Dimension_Label**: Etiqueta visual superpuesta en la escena 3D que muestra el valor numérico de una medida.
- **Snap_Point**: Punto de ajuste automático (esquina, arista o centro de superficie) al que se ancla el cursor durante la medición.
- **Camera**: Punto de vista virtual del usuario dentro del Room_Viewer.

---

## Requisitos

### Requisito 1: Definición de la habitación

**User Story:** Como usuario, quiero introducir las dimensiones de una habitación (ancho, alto y largo), para que la aplicación genere un modelo 3D fiel a la estancia real.

#### Criterios de Aceptación

1. THE Room_Viewer SHALL renderizar una habitación a partir de los valores de ancho, alto y largo expresados en metros proporcionados por el usuario.
2. WHEN el usuario modifica cualquier dimensión de la habitación, THE Room_Viewer SHALL actualizar el modelo 3D en tiempo real sin requerir recarga de la página.
3. IF el usuario introduce un valor de dimensión menor o igual a cero, THEN THE Room_Viewer SHALL mostrar un mensaje de error indicando que las dimensiones deben ser valores positivos mayores que cero.
4. IF el usuario introduce un valor de dimensión superior a 100 metros, THEN THE Room_Viewer SHALL mostrar un aviso indicando que el valor está fuera del rango habitual (0–100 m) y solicitará confirmación antes de aplicarlo.
5. THE Room_Viewer SHALL renderizar las seis superficies de la habitación: suelo, techo y cuatro paredes, diferenciadas visualmente mediante colores o texturas distintas.

---

### Requisito 2: Visualización 3D interactiva

**User Story:** Como usuario, quiero navegar libremente por la habitación en 3D, para que pueda examinar cualquier ángulo y superficie antes de tomar medidas.

#### Criterios de Aceptación

1. THE Camera SHALL permitir rotación orbital alrededor del centro de la habitación mediante arrastre con el botón izquierdo del ratón o gesto de un dedo en pantalla táctil.
2. THE Camera SHALL permitir zoom de acercamiento y alejamiento mediante la rueda del ratón o gesto de pellizco en pantalla táctil, dentro de un rango que mantenga la habitación completamente visible.
3. THE Camera SHALL permitir desplazamiento lateral (pan) mediante arrastre con el botón derecho del ratón o gesto de dos dedos en pantalla táctil.
4. WHEN el usuario hace doble clic sobre una superficie, THE Camera SHALL desplazarse suavemente hasta una vista frontal centrada en esa superficie en un tiempo máximo de 500 ms.
5. THE Room_Viewer SHALL mantener una tasa de refresco mínima de 30 fotogramas por segundo durante la navegación en un dispositivo de gama media.

---

### Requisito 3: Herramienta de medición entre dos puntos

**User Story:** Como usuario, quiero seleccionar dos puntos en cualquier superficie de la habitación, para que la aplicación calcule y muestre la distancia real entre ellos.

#### Criterios de Aceptación

1. WHEN el usuario activa la Measurement_Tool y hace clic sobre una superficie, THE Measurement_Tool SHALL colocar un Anchor_Point en la posición exacta del clic proyectada sobre la geometría 3D.
2. WHEN el usuario coloca el segundo Anchor_Point, THE Measurement_Tool SHALL renderizar una Measurement_Line entre ambos puntos y mostrar una Dimension_Label con la distancia en metros con dos decimales de precisión.
3. THE Measurement_Tool SHALL calcular la distancia euclidiana tridimensional entre los dos Anchor_Points.
4. WHEN el cursor se aproxima a una esquina, arista o centro de superficie a menos de 10 píxeles, THE Measurement_Tool SHALL activar el Snap_Point más cercano y resaltarlo visualmente.
5. THE Room_Viewer SHALL permitir al usuario crear múltiples Measurement_Lines simultáneas sin límite predefinido de mediciones activas.
6. WHEN el usuario hace clic sobre una Measurement_Line existente y pulsa la tecla Suprimir, THE Measurement_Tool SHALL eliminar esa Measurement_Line y sus Anchor_Points asociados.

---

### Requisito 4: Medición de dimensiones principales de la habitación

**User Story:** Como usuario, quiero ver las dimensiones principales de la habitación (ancho, alto y largo) representadas visualmente en el modelo 3D, para que pueda identificarlas de un vistazo sin necesidad de medición manual.

#### Criterios de Aceptación

1. THE Room_Viewer SHALL mostrar Dimension_Labels permanentes para el ancho, el alto y el largo de la habitación, posicionadas sobre las aristas correspondientes del modelo 3D.
2. WHEN el usuario modifica las dimensiones de la habitación, THE Room_Viewer SHALL actualizar las Dimension_Labels permanentes de forma inmediata.
3. THE Room_Viewer SHALL diferenciar visualmente las Dimension_Labels permanentes de las Dimension_Labels generadas por la Measurement_Tool mediante estilo tipográfico o color distintos.

---

### Requisito 5: Exportación de medidas

**User Story:** Como usuario, quiero exportar todas las medidas tomadas en la sesión, para que pueda consultarlas fuera de la aplicación.

#### Criterios de Aceptación

1. WHEN el usuario solicita la exportación, THE Measurement_Tool SHALL generar un archivo en formato JSON que contenga las coordenadas de cada par de Anchor_Points y la distancia calculada de cada Measurement_Line activa.
2. WHEN el usuario solicita la exportación, THE Measurement_Tool SHALL generar un archivo en formato CSV con una fila por cada Measurement_Line que incluya: identificador, coordenadas del primer punto (x, y, z), coordenadas del segundo punto (x, y, z) y distancia en metros.
3. IF no existe ninguna Measurement_Line activa en el momento de la exportación, THEN THE Measurement_Tool SHALL mostrar un mensaje informativo indicando que no hay medidas disponibles para exportar.

---

### Requisito 6: Persistencia de la sesión

**User Story:** Como usuario, quiero que la aplicación recuerde las dimensiones de la habitación y las medidas tomadas al recargar la página, para que no pierda mi trabajo entre sesiones.

#### Criterios de Aceptación

1. THE Room_Viewer SHALL guardar automáticamente el Room_Model y todas las Measurement_Lines activas en el almacenamiento local del navegador cada vez que se produzca un cambio.
2. WHEN el usuario recarga la página, THE Room_Viewer SHALL restaurar el Room_Model y las Measurement_Lines desde el almacenamiento local si existe una sesión guardada.
3. WHEN el usuario solicita restablecer la sesión, THE Room_Viewer SHALL eliminar los datos del almacenamiento local y cargar la configuración por defecto (habitación de 5 × 3 × 2,5 metros sin mediciones).
