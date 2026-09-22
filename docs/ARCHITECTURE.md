# Arquitectura — Entrenador Digital

## Resumen

Entrenador Digital separa una aplicación web local de un contenedor Android pequeño. No requiere backend ni cuenta de usuario.

```text
Entrenador Digital
├── web/
│   ├── src/domain/       tipos, IDs, metadatos y validación pura
│   ├── src/components/   controles reutilizables
│   ├── src/storage/      IndexedDB y esquema de backup
│   ├── src/platform/     bridge Android explícito
│   ├── src/cognitive-games.ts
│   ├── src/profiles.ts
│   └── src/main.ts       orquestación y pantallas
├── android/
│   └── app/src/main/java/com/entrenadordigital/app/
│       ├── MainActivity.kt
│       ├── NativeBridge.kt
│       ├── BackupManager.kt
│       ├── UpdateManager.kt
│       └── UpdateApkProvider.kt
└── .github/workflows/
```

Los assets web se compilan con Vite y se empaquetan dentro del APK mediante `WebViewAssetLoader`.

## Principios de diseño

- Una sola fuente de verdad para IDs y metadatos de ejercicios.
- Milisegundos como unidad interna para tiempos persistidos y de ejecución.
- Validadores puros para impedir configuraciones no jugables.
- Comunicación explícita entre módulos; no se usan `MutationObserver` como bus interno.
- Los controles interactivos se montan una vez y son responsables de sus propios eventos.
- La capa web debe seguir funcionando en preview aunque el bridge nativo no exista.

## Capa web

### Dominio

`src/domain/exercises.ts` centraliza:

- IDs de ejercicios;
- categorías;
- metadatos;
- direcciones;
- colores;
- consignas compartidas.

`src/domain/validation.ts` contiene reglas de configuración independientes del DOM.

`training-timing.ts` concentra defaults, mínimos y máximos de tiempo para todos los ejercicios.

### Componentes

`src/components/stepper.ts` implementa el control numérico completo:

- coma o punto decimal;
- límites;
- pulsación mantenida;
- teclado;
- normalización;
- eventos.

No existe una segunda capa de listeners globales que anule el comportamiento del control.

### Perfiles

Los perfiles usan autosave y guardan la configuración global por ejercicio. Los tiempos se persisten en milisegundos.

El cargador de perfiles mantiene compatibilidad con la estructura anterior, que almacenaba segundos, y normaliza los valores al esquema actual.

### Persistencia

- `localStorage`: ajustes, perfil activo y perfiles.
- IndexedDB `entrenador-digital`: sesiones e infraestructura de compatibilidad para datos antiguos.
- Backup JSON: datos propios de la app + stores locales.

La importación de backup valida toda la estructura antes de escribir. La restauración de stores se realiza en una única transacción IndexedDB y conserva una copia en memoria para rollback de mejor esfuerzo.

### Navegación y ciclo de vida

`main.ts` controla la pantalla activa y llama explícitamente a:

- sincronización del modo nativo;
- mejoras de perfiles;
- componentes y handlers de pantalla.

Los módulos no esperan a que aparezca determinado texto o nodo para descubrir el estado de la aplicación.

## Temporización

- Reloj monotónico: `performance.now()`.
- Presentación sincronizada con `requestAnimationFrame()` cuando corresponde.
- `setTimeout()` se usa como scheduler, no como reloj exacto.
- Todos los defaults son positivos y se validan con tests.
- Los límites se centralizan en `TIMING_POLICIES`.

## Capa Android

### MainActivity

Responsable de:

- crear y alojar el WebView;
- WindowInsets;
- modo inmersivo;
- pantalla encendida durante entrenamiento;
- Android Back.

### NativeBridge

Expone exclusivamente las capacidades necesarias a la web:

- `setTrainingMode`;
- `vibrate`;
- `getAppVersion`;
- `saveBackup`;
- `openBackup`;
- `finishApp`.

### BackupManager

Aísla Storage Access Framework, lectura/escritura de archivos y entrega del JSON al WebView.

### UpdateManager

Aísla el actualizador nativo. Una actualización descargada se valida antes de abrir el instalador:

- respuesta y tamaño de descarga;
- SHA-256 cuando GitHub lo publica;
- `packageName`;
- `versionCode`;
- versión declarada;
- firma compatible con la instalación existente.

## Seguridad WebView

- `allowFileAccess = false`.
- `allowContentAccess = false`.
- Recursos web servidos por `WebViewAssetLoader`.
- Navegación restringida a `appassets.androidplatform.net`.
- Debugging web sólo en builds DEBUG.
- El bridge se elimina en `onDestroy`.
- Tráfico cleartext deshabilitado.

Internet se usa únicamente para consultar/descargar actualizaciones desde GitHub Releases.

## Compatibilidad

- `minSdk 21`.
- APK universal.
- AndroidX WebKit fijado a una versión compatible con Android 5.
- CSS con fallbacks para WebViews antiguos donde son necesarios.

## Tests y CI

El workflow de PR ejecuta:

1. instalación de dependencias web;
2. `tsc --noEmit` + build Vite;
3. tests Vitest;
4. build del APK debug.

Los tests cubren actualmente:

- políticas/defaults de tiempo;
- sanitización;
- validación de configuración;
- registro de ejercicios;
- esquema de backup.

Los releases oficiales continúan construyéndose desde source y usando la firma permanente configurada en GitHub Actions.
