# Producto — Entrenador Digital

## Propósito

Entrenador Digital es una aplicación de entrenamiento de reacción orientada principalmente a Android. Debe funcionar sin conexión, sin cuentas y sin infraestructura remota. El producto se distribuye como un APK universal que contiene localmente toda la interfaz y la lógica de entrenamiento.

## Objetivos de producto

1. Ser comprensible sin tutorial previo.
2. Dar prioridad visual al estímulo durante el entrenamiento.
3. Registrar tiempos de reacción y calidad de respuesta de forma consistente.
4. Permitir repetir sesiones mediante presets.
5. Mantener historial y estadísticas exclusivamente en el dispositivo.
6. Poder ampliarse con nuevos ejercicios sin reescribir el motor.

## Modos previstos

- Flechas.
- Números.
- Colores.
- Color + número.
- Color y palabra (Stroop).
- Palabras.

El MVP implementará Flechas de punta a punta y dejará preparado el motor común para el resto.

## Flujo principal

`Inicio → Configuración → Entrenamiento → Resultados`

Flujos secundarios:

- `Inicio → Historial → Detalle de sesión`
- `Inicio → Presets → Configuración/Entrenamiento`
- `Inicio → Ajustes`

## Principios de experiencia

- Una acción principal clara por pantalla.
- Controles táctiles grandes y legibles.
- Configuración básica visible; opciones avanzadas separadas.
- Sin elementos decorativos que compitan con el estímulo.
- Durante la sesión: modo oscuro inmersivo, alto contraste y mínimo ruido visual.
- El color nunca será el único indicador de acierto/error.

## Medición

Los tiempos de reacción se calculan con `performance.now()` y el instante de presentación del estímulo se sincroniza con `requestAnimationFrame()` cuando corresponda. Los resultados se expresan en milisegundos, dejando claro que se trata de medición de software y que el dispositivo introduce latencia de pantalla, táctil y composición.

## Resultados por sesión

- Media.
- Mediana.
- Mejor tiempo.
- Peor tiempo.
- Precisión.
- Respuestas correctas.
- Respuestas incorrectas.
- Anticipaciones.
- Omisiones.

## Privacidad

- Sin autenticación.
- Sin backend.
- Sin analítica.
- Sin telemetría.
- Sin recursos remotos obligatorios.
- Datos persistidos localmente.
- Exportación/importación manual de respaldo en una fase posterior.
