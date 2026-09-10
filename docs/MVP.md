# MVP — Entrenador Digital

## Alcance

El primer hito debe producir una aplicación utilizable de punta a punta con el ejercicio Flechas como entrenador visual para actividad física real.

La app no evalúa una respuesta táctil durante este modo. Su función es generar estímulos visuales temporizados para que la persona responda fuera del dispositivo.

## Incluido

### Inicio

- Identidad visual definitiva base.
- Cards de los seis ejercicios.
- Flechas habilitado.
- Resto de ejercicios visibles como próximos modos, sin falsas funciones.
- Acceso a Historial preparado.

### Configuración de Flechas

- Finalizar por cantidad de estímulos.
- Cantidad de estímulos.
- Espera mínima y máxima entre estímulos.
- Duración visible de cada flecha.
- Selección de ocho direcciones: arriba, arriba derecha, derecha, abajo derecha, abajo, abajo izquierda, izquierda y arriba izquierda.
- Validación de valores.
- Explicación clara de que la respuesta se realiza físicamente y no tocando la pantalla.

### Entrenamiento

- Cuenta regresiva inicial que desaparece al terminar.
- Modo oscuro de alto contraste.
- Barra de progreso.
- Contador de estímulos completados.
- Flecha principal de gran tamaño y prioridad visual absoluta.
- Ocho direcciones posibles, incluidas las cuatro diagonales.
- Intervalos aleatorios.
- Duración visible configurable.
- Ejecución completamente automática después de iniciar.
- Botón visible `Detener` durante toda la sesión.
- Flecha de volver funcional durante la sesión: solicita confirmación, detiene timers y vuelve a configuración.
- Botón Atrás del sistema Android integrado con el mismo flujo de detención segura.
- La pantalla se mantiene encendida y en modo inmersivo durante la sesión.

### Resultados

- Estímulos completados.
- Duración real de la sesión.
- Duración visible configurada.
- Cantidad de direcciones activas.
- Rango de espera utilizado.
- Repetir entrenamiento.
- Volver al inicio.

No se muestran tiempos de reacción, precisión, errores, omisiones ni anticipaciones en el modo Flechas pasivo porque la aplicación no observa la respuesta física del usuario.

### Persistencia

- Guardar sesiones completadas localmente.
- Historial básico de sesiones.
- El esquema de datos del prototipo táctil anterior se descarta al migrar al esquema pasivo, ya que sus métricas no son comparables.

### Android

- APK universal.
- Assets 100 % locales.
- Fullscreen/immersive durante entrenamiento.
- Mantener pantalla encendida durante la sesión.
- Sin permiso de Internet.
- Navegación Atrás nativa coordinada con el estado del entrenamiento.

## Fuera del MVP

- Cuentas.
- Sincronización.
- Backend.
- Servicios remotos.
- Compartir resultados.
- Exportar/importar respaldo.
- Sonidos configurables avanzados.
- Ejercicios distintos de Flechas completamente funcionales.
- Estadísticas longitudinales complejas.
- Evaluación automática de la reacción física mediante sensores externos.

## Criterios de aceptación

1. Se puede instalar el APK en un Android compatible sin conexión.
2. La app puede completar una sesión de Flechas sin acceso a Internet.
3. El estímulo es el elemento dominante de la pantalla de sesión.
4. Las ocho direcciones pueden seleccionarse individualmente en configuración.
5. La cuenta regresiva `¡Ya!` desaparece completamente antes del primer estímulo.
6. No aparece ningún mensaje de `Sin respuesta`, error o anticipación durante el modo pasivo.
7. `Detener` cancela inmediatamente la sesión tras confirmación y limpia todos los timers.
8. La flecha de volver y el botón Atrás de Android usan el mismo flujo seguro de detención cuando la sesión está activa.
9. Una sesión completada aparece en Historial tras cerrar y volver a abrir la app.
10. Ningún recurso esencial se carga desde una URL externa.
