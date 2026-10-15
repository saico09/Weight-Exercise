# Weight&Exercise · v0.4

**Esta carpeta corresponde a la rama `basic`.** Su vista local usa el puerto **5174** y su APK lleva el identificador `cl.forma.weightexercise.basic`. La infraestructura de cuenta y respaldo se ejecuta desde la carpeta de la rama `pro`; Basic funciona completamente sin servidor.

App Android para registrar peso, ejercicio y alimentación, con interfaz adaptable a teléfono y PC. Ionic React, TypeScript y Capacitor. Los registros se guardan primero en el dispositivo; Pro incorpora un prototipo de respaldo manual con cuenta, probado en un servidor Docker local.

## Basic y Pro

Las ediciones se mantienen en las ramas **`basic`** y **`pro`**, con dos carpetas de trabajo independientes para ejecutarlas simultáneamente. `src/lib/edition.ts` define la edición de cada rama. Esta separación es para desarrollo y revisión: todavía no hay compras, cobros ni integración con Google Play Billing.

| Funcionalidad | Basic gratuita | Pro |
| --- | --- | --- |
| Registros e historial completo, sin límite de días | Sí | Sí |
| Editar registros, hábitos y punto de partida | Sí | Sí |
| Temas Dark y Light; español e inglés; kg/lb y cm/pies | Sí | Sí |
| Gráfico de peso, meta, IMC y estadísticas esenciales | Sí | Sí |
| Logros, copas y celebraciones | Sí | Sí |
| Motivación con foto y mensaje personalizables | Sí | Sí |
| Recordatorio para registrar el peso | Sí | Sí |
| Colores personalizados | — | Sí |
| Promedios y comparación entre semanas | — | Sí |
| Informes PDF según tema y color | — | Sí |
| Notificaciones de recuento semanal o mensual | — | Sí |
| Cuenta por código de correo y respaldo manual | — | Prueba local en PC |

El botón **Necesito Motivación** aparece en Inicio y en el editor diario. Abre un gatito con «Hazlo por él»; permite reemplazar la foto y el mensaje. Las fotos se redimensionan y se eliminan sus metadatos en el dispositivo antes de guardarlas. La imagen preparada ocupa como máximo unos 183 KiB.

## Abrir ambas versiones en tu PC

Requisitos: Node.js 22 o superior. Ejecuta `npm install` en cada carpeta de trabajo. Para la nube local, instala e inicia Docker Desktop con el motor Linux.

Desde la carpeta de la rama `pro`, indicando la carpeta real de la rama `basic`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-both.ps1 -BasicPath 'C:\ruta\WeightExercise-Basic'
```

| Servicio | Dirección local |
| --- | --- |
| Pro | http://127.0.0.1:5173 |
| Basic | http://127.0.0.1:5174 |
| Bandeja de códigos de prueba | http://127.0.0.1:8025 |
| Estado de la API | http://127.0.0.1:3001/api/health |

También puedes iniciar cada interfaz desde su propia carpeta:

```powershell
# En la carpeta de la rama pro
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-preview.ps1 -Port 5173

# En la carpeta de la rama basic
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-preview.ps1 -Port 5174
```

`INICIAR-APP.cmd` inicia la vista de la carpeta actual. El iniciador reutiliza una vista existente de Weight&Exercise en el puerto elegido y no detiene procesos ajenos. `-NoBrowser` evita abrir el navegador. Los diagnósticos quedan en `.preview-server.log` y `.preview-errors.log` de cada carpeta.

**Mantén la misma dirección para tus pruebas:** `localhost`, `127.0.0.1` y distintos puertos tienen almacenamientos separados. Basic y Pro no mezclan sus historiales locales.

## Cuenta y respaldo local de Pro

Para iniciar la infraestructura desde la rama `pro`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-cloud.ps1
```

El script crea secretos locales en `.env.local`, excluido de Git, y arranca PostgreSQL, la API y Mailpit. Los códigos se leen en la bandeja de pruebas de este PC; **no se envían correos reales**. PostgreSQL no publica un puerto al host. API y Mailpit escuchan únicamente en `127.0.0.1`.

En Pro puedes crear una cuenta desde la bienvenida o Ajustes, elegir nombre de usuario, iniciar sesión con código, cambiar el correo y eliminar la cuenta. Un código por correo es acceso sin contraseña, **no autenticación de dos factores**.

El respaldo es manual: **Respaldar ahora** reemplaza la copia de esa cuenta; **Restaurar respaldo** reemplaza los datos locales después de confirmar. Iniciar sesión no sube ni mezcla registros. Cerrar sesión conserva los datos del dispositivo; eliminar la cuenta borra su copia del servidor, pero también conserva los datos locales. El reinicio de la app borra su información local y es una acción distinta.

El prototipo está preparado para evaluar el consumo antes de usar Lightsail. PostgreSQL tiene un límite de 256 MiB, la API 192 MiB y Mailpit 64 MiB: son límites de contenedor, no mediciones ni una garantía de capacidad bajo carga. La base usa buffers pequeños, pocas conexiones y registros de diagnóstico acotados. Mailpit es solo para desarrollo. No se ha desplegado ni modificado ningún recurso de AWS.

Para detener la infraestructura conservando los datos:

```powershell
docker compose --env-file .env.local stop
```

El volumen Docker conserva la base al reiniciar servicios. No uses `down -v` si deseas conservarla. Un volumen local no sustituye un respaldo externo; la estrategia de copias y restauración debe validarse antes de producción.

## Android instalable

Los APK de prueba v0.4 se generan localmente en:

- `output/WeightExercise-Pro-debug.apk`
- `output/WeightExercise-Basic-debug.apk`

Pro conserva `cl.forma.weightexercise`; Basic utiliza `cl.forma.weightexercise.basic`. Pueden instalarse juntas para comparar las ediciones y mantienen datos separados. Pro conserva la identidad anterior para actualizarla con la misma firma de desarrollo. No desinstales la app si deseas conservar sus datos locales.

Copia el APK al teléfono, ábrelo desde el administrador de archivos y permite la instalación desde ese administrador si Android lo solicita. Los APK incluyen las imágenes y fuentes necesarias para funcionar sin la PC.

**La cuenta y el respaldo están deshabilitados en estos APK** hasta disponer de un backend de producción por HTTPS. En el PC se pueden probar con Docker. La motivación, los gráficos y el resto de funciones locales siguen disponibles; Pro prepara informes para guardar o compartir mediante el selector nativo de Android. La entrega de notificaciones y el selector de compartir requieren validación adicional en un teléfono físico.

El proyecto requiere JDK 21 y Android SDK 36; admite Android 7.0 (API 24) o superior. Para instalar las herramientas oficiales gratuitas tras aceptar su licencia:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-android-sdk.ps1 -AcceptSdkLicense
```

Lee previamente la [licencia del Android SDK](https://developer.android.com/studio/terms). El script instala el SDK dentro de `.tools/android-sdk`; también puedes usar Android Studio. Para compilar desde la rama deseada:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-android.ps1
```

El script compila la web, sincroniza Capacitor y ejecuta Gradle. Genera `android/app/build/outputs/apk/debug/app-debug.apk` y la copia local indicada al terminar. Los nombres Pro/Basic anteriores identifican las copias de entrega de cada edición. Son compilaciones firmadas para desarrollo; no son versiones publicadas en Google Play. La distribución prevista es solo **Google Play**; firma de publicación, ficha de tienda y compras quedan como trabajo posterior.

## Datos, recordatorios e informes

En Android, [Capacitor Preferences](https://capacitorjs.com/docs/apis/preferences) guarda los datos en las preferencias privadas de la app; en navegador se usa el almacenamiento del sitio. La configuración nativa desactiva el respaldo y la transferencia automática de Android. Borrar datos del sitio, desinstalar o borrar los datos de la app puede eliminar los registros.

Los recordatorios solicitan permiso al activarlos. Basic ofrece el aviso de registro diario; Pro añade un recuento semanal o mensual que compara registros con sus fechas, peso y hábitos. Los textos se actualizan con la información disponible cuando se programa el aviso; no existe un servicio de seguimiento en segundo plano que invente nuevas mediciones. Android puede retrasarlos por ahorro de batería. La vista web no garantiza avisos si el navegador está cerrado.

Los informes Pro se generan localmente desde Estadísticas, con un rango de fechas elegido. Incluyen resumen, curva de peso, hábitos y tabla de registros. Respetan el idioma, la unidad, el tema y el color actual. Para regenerar muestras con datos ficticios:

```powershell
node scripts/preview-reports.mjs
```

El IMC es una referencia, no un diagnóstico. Se muestran categorías adultas desde los 20 años; la app no calcula percentiles para menores. [Referencia del CDC](https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html).

## Desarrollo

```powershell
npm run dev       # Vista de desarrollo
npm run build     # TypeScript y compilación web
npm run preview   # Servir dist/
npm test          # Pruebas de la app
npm run android   # Compilar, sincronizar y abrir Android Studio
```

Los scripts usan Node directamente para admitir rutas con `&`. `npm run dev` y `npm run preview` escuchan en la red local; los iniciadores de Windows escuchan solo en `127.0.0.1`.

[Ideas y prioridades de Pro](docs/PRO-ROADMAP.md) · [Fotografías y licencias](ASSETS.md)
