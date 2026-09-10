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
- Error: `#E24C4B`.
- Advertencia: `#F29F05`.

Los estados semánticos quedan disponibles para futuros ejercicios evaluables; el modo Flechas del MVP no clasifica respuestas porque la reacción ocurre físicamente fuera del dispositivo.

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
- Área táctil mínima de 48 × 48 CSS px para acciones esenciales.
- Estados de foco visibles.
- No comunicar estados importantes únicamente mediante color.
- Soportar aumento de texto sin cortar controles principales.
- Respetar `prefers-reduced-motion`.
- El estímulo visual debe conservar contraste máximo y una silueta inequívoca en las ocho orientaciones.

## Idioma

Español estándar, directo y consistente. Se evita terminología técnica en la interfaz.

Ejemplos:

- `Configura tu entrenamiento`.
- `Selecciona las direcciones`.
- `Iniciar entrenamiento`.
- `Tiempo transcurrido`.
- `Detener`.
- `Repetir entrenamiento`.

## Pantalla de inicio

Debe mostrar el nombre y propósito de la app y ofrecer inmediatamente los seis ejercicios principales.

Orden:

1. Cabecera de marca.
2. Mensaje breve de entrenamiento.
3. Cuadrícula de ejercicios de 2 columnas.
4. Accesos a Historial, Presets y Ajustes.

## Configuración — Flechas

El modo Flechas es un generador de estímulos para entrenamiento físico. La app no solicita una respuesta táctil.

Secciones:

- Sesión: cantidad total de estímulos.
- Aparición: espera mínima y máxima entre señales.
- Estímulo: duración visible de cada flecha.
- Direcciones: selección individual de las ocho orientaciones.

Direcciones disponibles:

`↑  ↗  →  ↘  ↓  ↙  ←  ↖`

Etiquetas completas:

- Arriba.
- Arriba derecha.
- Derecha.
- Abajo derecha.
- Abajo.
- Abajo izquierda.
- Izquierda.
- Arriba izquierda.

Debajo de la configuración se muestra una nota breve que explica que la aplicación presenta las señales automáticamente y que la respuesta se realiza en el entrenamiento real. La acción `Iniciar entrenamiento` permanece claramente visible al final.

## Entrenamiento — Flechas

Esta pantalla cambia a fondo `#031E54` y minimiza la interfaz para que el estímulo sea dominante.

Jerarquía:

1. Cabecera mínima con flecha de volver, nombre del ejercicio y botón `Detener`.
2. Barra de progreso.
3. Contador de estímulos completados.
4. Tiempo transcurrido.
5. Estímulo central dominante.
6. Lema discreto al pie.

No existen botones de respuesta durante este ejercicio. La sesión funciona así:

`espera aleatoria → muestra flecha → mantiene señal visible → oculta señal → nueva espera`

La flecha central debe ocupar aproximadamente 50–70 % del espacio útil disponible cuando el viewport lo permita. Las diagonales usan la misma figura SVG rotada en incrementos de 45 grados para mantener forma, tamaño y contraste idénticos.

### Inicio de sesión

La cuenta regresiva muestra `3`, `2`, `1`, `¡Ya!`. `¡Ya!` se elimina del DOM visual antes de iniciar la primera espera. La regla global `[hidden] { display: none !important; }` impide que estilos de la cuenta regresiva anulen el atributo `hidden`.

### Detener y volver

Durante una sesión activa siempre deben existir dos salidas visibles o físicas:

- Botón `Detener` en la cabecera.
- Flecha de volver en la cabecera.

Ambas ejecutan el mismo flujo: pedir confirmación, cancelar cualquier timer activo, abandonar el modo inmersivo y regresar a Configuración. La sesión incompleta no se guarda.

El botón Atrás físico/gestual de Android debe invocar el mismo flujo mientras el entrenamiento está en marcha. Fuera del entrenamiento vuelve a la pantalla lógica anterior o cierra la app desde Inicio.

## Resultados

Como el modo Flechas no mide la respuesta física, los resultados describen la sesión ejecutada y no pretenden inferir rendimiento del deportista.

Orden:

1. Resumen de sesión completada.
2. Estímulos completados.
3. Duración real de la sesión.
4. Duración visible de la señal.
5. Cantidad de direcciones activas.
6. Rango de espera utilizado.
7. Acciones: Repetir entrenamiento e Inicio.

No mostrar en este modo:

- promedio de reacción;
- mediana de reacción;
- precisión;
- respuestas correctas o incorrectas;
- anticipaciones;
- omisiones.

Esas métricas sólo serán válidas para futuros modos que realmente observen una respuesta.

## Responsive

Diseño mobile-first con soporte explícito para portrait y landscape. No se diseñará alrededor de resoluciones fijas. Se utilizarán `clamp()`, `min()`, `max()`, grid/flex y unidades relativas, con fallbacks para WebView antiguos.

La configuración de ocho direcciones usa dos columnas en teléfonos y puede expandirse a cuatro columnas cuando el ancho disponible sea suficiente.
