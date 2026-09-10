# UX/UI — Entrenador Digital

## Identidad visual

Paleta principal:

- Azul de acción: `#019CE8`.
- Azul profundo: `#031E54`.
- Blanco: `#FFFFFF`.

Neutros:

- Fondo claro: `#F4F7FB`.
- Texto principal: `#10233F`.
- Texto secundario: `#5B6B84`.
- Borde: `#D9E3F0`.
- Superficie oscura secundaria: `#0A2A4B`.

Estados:

- Correcto: `#1FA971`.
- Incorrecto: `#E24C4B`.
- Advertencia/anticipación: `#F29F05`.

## Dirección estética

La interfaz debe sentirse deportiva, tecnológica y sobria. Se evitan estilos gamer, neón excesivo, glassmorphism pesado y decoraciones que reduzcan la legibilidad.

Características:

- Cards blancas sobre fondo gris azulado muy claro.
- Bordes redondeados de 16–20 px.
- Sombras suaves y discretas.
- Azul profundo para identidad y modo entrenamiento.
- Azul brillante reservado para acciones, progreso y énfasis.
- Iconografía simple, preferentemente SVG.

## Tipografía

Se utilizará una pila sans-serif local del sistema en el prototipo. Más adelante puede incorporarse Inter como recurso embebido si aporta consistencia suficiente sin perjudicar peso ni compatibilidad.

Escala orientativa:

- Título principal: 30–32 px, 700.
- Título de pantalla: 22–26 px, 700.
- Subtítulo: 14–16 px, 400/500.
- Texto base: 16 px.
- Texto auxiliar: 13–14 px.
- Métricas: 28–36 px, 700.
- Temporizador de sesión: 52–64 px, 700.

## Espaciado

Sistema base de 4 px con escalones preferidos: 4, 8, 12, 16, 20, 24, 32 y 40 px.

## Accesibilidad

- Objetivo WCAG AA en contraste de texto y controles.
- Área táctil mínima de 48 × 48 CSS px; preferencia por 56 px en acciones primarias.
- Estados de foco visibles.
- No comunicar errores únicamente mediante color.
- Soportar aumento de texto sin cortar controles principales.
- Respetar `prefers-reduced-motion`.

## Idioma

Español estándar, directo y consistente. Se evita terminología técnica en la interfaz.

Ejemplos:

- `Configura tu entrenamiento`.
- `Selecciona las direcciones`.
- `Iniciar entrenamiento`.
- `Tiempo restante`.
- `Repetir entrenamiento`.

## Pantalla de inicio

Debe mostrar el nombre y propósito de la app y ofrecer inmediatamente los seis ejercicios principales.

Orden:

1. Cabecera de marca.
2. Mensaje breve de entrenamiento.
3. Cuadrícula de ejercicios 2 columnas.
4. Accesos a Historial, Presets y Ajustes.

## Configuración — Flechas

Secciones:

- Sesión.
- Aparición.
- Estímulo.
- Direcciones.
- Respuesta.
- Opciones avanzadas, colapsadas por defecto.

La acción `Iniciar entrenamiento` permanece claramente visible al final.

## Entrenamiento — Flechas

Esta pantalla cambia a fondo `#031E54` y minimiza la interfaz.

Jerarquía:

1. Cabecera mínima con nombre de ejercicio y salida.
2. Barra de progreso y contador.
3. Tiempo restante.
4. Estímulo central dominante.
5. Controles de respuesta en una sola fila horizontal.

Los cuatro botones de respuesta deben ser compactos pero cómodos:

`[↑ Arriba] [→ Derecha] [↓ Abajo] [← Izquierda]`

En teléfonos estrechos el texto puede abreviarse visualmente o pasar debajo del icono, pero los cuatro controles permanecen en una sola fila. La flecha central debe ocupar aproximadamente 40–55 % de la altura útil restante, según orientación.

## Resultados

Orden:

1. Resumen de sesión.
2. Cuatro métricas principales: Promedio, Mediana, Mejor y Precisión.
3. Gráfico de tiempos de reacción.
4. Correctas, Incorrectas, Anticipaciones y Omitidas.
5. Acciones: Guardar preset, Repetir, Inicio.

## Responsive

Diseño mobile-first con soporte explícito para portrait y landscape. No se diseñará alrededor de resoluciones fijas. Se utilizarán `clamp()`, `min()`, `max()`, grid/flex y unidades relativas.
