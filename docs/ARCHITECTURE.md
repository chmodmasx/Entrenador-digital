# Arquitectura — Entrenador Digital

## Resumen

El proyecto separa un núcleo web reutilizable de un contenedor Android mínimo.

```text
Entrenador Digital
├── web/       HTML + CSS + TypeScript
├── android/   Kotlin + WebViewAssetLoader
└── .github/   CI/CD
```

La aplicación no requiere backend. En Android, todos los recursos web se empaquetan dentro del APK.

## Capa web

Responsabilidades:

- navegación;
- interfaz;
- motor de sesiones;
- generación de estímulos;
- validación de respuestas;
- cálculo de resultados;
- presets e historial;
- persistencia local.

Tecnologías:

- TypeScript;
- HTML;
- CSS;
- Vite para desarrollo/build;
- IndexedDB para persistencia durable;
- SVG/Canvas para gráficos.

No se utilizará un framework UI grande en la primera etapa.

## Capa Android

Responsabilidades:

- alojar WebView;
- servir assets locales con `WebViewAssetLoader`;
- modo inmersivo;
- mantener pantalla encendida durante sesiones;
- vibración nativa cuando corresponda;
- importación/exportación y compartir, en fases posteriores;
- información de versión de la app.

El contenedor debe evitar permisos innecesarios. No se solicitará permiso de Internet mientras el producto no tenga una función que lo necesite.

## Compatibilidad

Objetivo inicial: `minSdk 21` (Android 5.0).

El APK será universal mientras no se incorporen bibliotecas nativas dependientes de ABI. La interfaz web deberá evitar APIs modernas imprescindibles sin fallback.

## Motor de entrenamiento

El motor será independiente de las pantallas.

```text
ExerciseEngine
├── SessionConfig
├── StimulusGenerator
├── Scheduler
├── ResponseEvaluator
├── Timer
└── SessionResult
```

Cada ejercicio implementará un contrato común para generar estímulos y evaluar respuestas.

## Temporización

- Reloj monotónico: `performance.now()`.
- Presentación de estímulos: sincronización con `requestAnimationFrame()` cuando sea útil.
- La lógica no asumirá que `setTimeout()` es exacto.
- Anticipaciones se registran si existe respuesta antes de que el estímulo esté activo.

## Persistencia

IndexedDB contendrá al menos:

- `settings`;
- `presets`;
- `sessions`.

Los datos de una sesión incluyen configuración, intentos y resumen calculado.

## Bridge Android/Web

El bridge debe ser pequeño y explícito. API prevista:

```text
setKeepScreenOn(enabled)
vibrate(milliseconds)
getAppVersion()
exportBackup(payload)      [posterior]
importBackup()             [posterior]
shareResult(payload)       [posterior]
```

La capa web debe funcionar aunque una función opcional del bridge no exista.

## Seguridad

- JavaScript del WebView sólo carga recursos de la aplicación.
- Sin navegación arbitraria a Internet.
- Bridge expuesto únicamente a contenido local controlado.
- Sin secretos en el cliente.
- Sin permisos Android que no sean necesarios.

## Build

Vite generará los assets web de producción. El proyecto Android copiará/incluirá esos assets para generar un APK release.

GitHub Actions realizará posteriormente:

1. build web;
2. pruebas;
3. build Android;
4. firma con secretos del repositorio;
5. publicación de APK universal al crear tags `v*`.
