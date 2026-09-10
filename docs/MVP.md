# MVP — Entrenador Digital

## Alcance

El primer hito debe producir una aplicación utilizable de punta a punta con el ejercicio Flechas.

## Incluido

### Inicio

- Identidad visual definitiva base.
- Cards de los seis ejercicios.
- Flechas habilitado.
- Resto de ejercicios visibles como próximos modos, sin falsas funciones.
- Accesos a Historial y Ajustes preparados.

### Configuración de Flechas

- Finalizar por repeticiones.
- Cantidad de repeticiones.
- Espera mínima y máxima entre estímulos.
- Tiempo máximo de respuesta.
- Selección de direcciones: arriba, derecha, abajo e izquierda.
- Modo de respuesta con botones en pantalla.
- Validación de valores.

### Entrenamiento

- Cuenta regresiva inicial.
- Modo oscuro de alto contraste.
- Barra de progreso.
- Flecha principal de gran tamaño.
- Cuatro botones compactos en una sola fila horizontal.
- Intervalos aleatorios.
- Medición con `performance.now()`.
- Respuesta correcta/incorrecta.
- Detección de anticipaciones.
- Omisiones por timeout.
- Pausa/salida segura.

### Resultados

- Promedio.
- Mediana.
- Mejor tiempo.
- Precisión.
- Correctas.
- Incorrectas.
- Anticipaciones.
- Omisiones.
- Gráfico de intentos.
- Repetir entrenamiento.
- Volver al inicio.

### Persistencia

- Guardar sesiones localmente.
- Historial básico.

### Android

- APK universal.
- Assets 100 % locales.
- Fullscreen/immersive durante entrenamiento.
- Mantener pantalla encendida durante la sesión.
- Sin permiso de Internet.

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

## Criterios de aceptación

1. Se puede instalar el APK en un Android compatible sin conexión.
2. La app puede completar una sesión de Flechas sin acceso a Internet.
3. Los cuatro botones de respuesta caben en una única fila en un viewport móvil de 320 CSS px sin solaparse.
4. El estímulo es el elemento dominante de la pantalla de sesión.
5. Una anticipación nunca se registra como tiempo de reacción válido.
6. El resumen distingue correctas, incorrectas, anticipaciones y omisiones.
7. Una sesión completada aparece en Historial tras cerrar y volver a abrir la app.
8. Ningún recurso esencial se carga desde una URL externa.
