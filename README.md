# Entrenador Digital

Aplicación de entrenamiento de reacción para Android, diseñada para funcionar completamente offline mediante un APK universal autocontenido.

## Objetivo

Entrenador Digital prioriza compatibilidad, claridad visual, baja latencia y facilidad de uso. La interfaz principal se implementa con tecnologías web locales y se distribuye dentro de un contenedor Android mínimo basado en WebView.

## Principios

- APK universal, sin variantes por versión de Android o arquitectura mientras no sean necesarias.
- Funcionamiento 100 % offline; sin backend, cuentas, telemetría ni APIs externas.
- Interfaz en español, clara, legible e intuitiva.
- Diseño profesional con `#019CE8`, `#031E54` y blanco como colores principales.
- Pantalla de entrenamiento inmersiva y de alto contraste.
- Motor de ejercicios separado de la interfaz para facilitar nuevos modos de entrenamiento.
- Persistencia local, historial, presets y exportación/importación de datos.

## Stack previsto

- Android: Kotlin + Android WebView + WebViewAssetLoader.
- Interfaz: HTML + CSS + TypeScript.
- Build web: Vite.
- Datos: IndexedDB.
- Gráficos: SVG/Canvas, sin dependencias pesadas.
- CI/CD: GitHub Actions para build, pruebas y releases APK.

## Estado

Proyecto en fase inicial de especificación y construcción del MVP. El primer ejercicio completo será **Flechas**.

Consulta la documentación en `docs/` para arquitectura, producto, UX/UI y alcance del MVP.
