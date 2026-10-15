# Weight&Exercise · Pro v0.5 / Basic v0.4

App Android para registrar peso, ejercicio y alimentación, con interfaz adaptable a teléfono y PC. Ionic React, TypeScript y Capacitor. Los registros se guardan primero en el dispositivo; Pro incorpora respaldo manual con cuenta y resúmenes por correo, ejecutados por un servidor Docker local. Esta actualización amplía Pro a v0.5; Basic conserva las funciones de v0.4.

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
| Temas Aurora y Sand, además de Dark y Light | — | Sí |
| Gráfico de área, línea, barras o perspectiva 3D | — | Sí |
| Promedios y comparación entre semanas | — | Sí |
| Selección y comparación de registros del historial | — | Sí |
| Exportación Excel (.xlsx) por mes, filtros o historial completo | — | Sí |
| Informes PDF con historial completo y períodos comparados | — | Sí |
| Notificaciones de recuento semanal o mensual | — | Sí |
| Cuenta por código de correo y respaldo manual | — | Prueba local en PC |
| Resumen semanal o mensual por correo con Excel adjunto | — | Opcional, desde el servidor local |
| Pasos de Health Connect en registros existentes | — | Android 14+, pendiente de prueba física |

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
| Bandeja de pruebas, cuando SMTP usa Mailpit | http://127.0.0.1:8025 |
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

El script crea secretos locales en `.env.local`, excluido de Git, y arranca PostgreSQL, la API y Mailpit. El modo predeterminado `mailpit` conserva los mensajes en la bandeja de este PC, sin enviarlos a Internet. El modo `real` usa SMTP autenticado con TLS para entregar códigos y resúmenes al correo del usuario. La conexión y autenticación de Gmail se verificaron sin enviar un mensaje real; esa comprobación no valida todavía la entrega al destinatario. PostgreSQL no publica un puerto al host. API y Mailpit escuchan únicamente en `127.0.0.1`.

En Pro puedes crear una cuenta desde la bienvenida o Ajustes, elegir nombre de usuario, iniciar sesión con código, cambiar el correo y eliminar la cuenta. Un código por correo es acceso sin contraseña, **no autenticación de dos factores**.

El respaldo es manual: **Respaldar ahora** reemplaza la copia de esa cuenta; **Restaurar respaldo** reemplaza los datos locales después de confirmar. Iniciar sesión no sube ni mezcla registros. Cerrar sesión conserva los datos del dispositivo; eliminar la cuenta borra su copia del servidor, pero también conserva los datos locales. El reinicio de la app borra su información local y es una acción distinta.

En Estadísticas → Informes Pro, **Correo** permite activar un resumen semanal o mensual con horario y zona horaria. Requiere cuenta, respaldo y consentimiento explícito para adjuntar **todo el historial respaldado, incluidas notas y pasos disponibles**. Los nuevos registros del teléfono solo se incluyen después de actualizar el respaldo manual. La programación se conserva en PostgreSQL y necesita que el PC y Docker sigan encendidos. Puede desactivarse desde la app o mediante el enlace de baja; los enlaces locales requieren este PC. [Configuración, pruebas y límites del correo](docs/LOCAL-CLOUD.md).

El prototipo está preparado para evaluar el consumo antes de usar Lightsail. PostgreSQL tiene un límite de 256 MiB, la API 192 MiB y Mailpit 64 MiB: son límites de contenedor, no mediciones ni una garantía de capacidad bajo carga. La base usa buffers pequeños, pocas conexiones y registros de diagnóstico acotados. Mailpit es solo para desarrollo. No se ha desplegado ni modificado ningún recurso de AWS.

Para detener la infraestructura conservando los datos:

```powershell
docker compose --env-file .env.local stop
```

El volumen Docker conserva la base al reiniciar servicios. No uses `down -v` si deseas conservarla. Un volumen local no sustituye un respaldo externo; la estrategia de copias y restauración debe validarse antes de producción.

## Android instalable

Los APK de prueba de Pro v0.5 y Basic v0.4 se generan localmente en:

- `output/WeightExercise-Pro-debug.apk`
- `output/WeightExercise-Basic-debug.apk`

Pro conserva `cl.forma.weightexercise`; Basic utiliza `cl.forma.weightexercise.basic`. Pueden instalarse juntas para comparar las ediciones y mantienen datos separados. Pro conserva la identidad anterior para actualizarla con la misma firma de desarrollo. No desinstales la app si deseas conservar sus datos locales.

Copia el APK al teléfono, ábrelo desde el administrador de archivos y permite la instalación desde ese administrador si Android lo solicita. Los APK incluyen las imágenes y fuentes necesarias para funcionar sin la PC.

**La cuenta, el respaldo y la configuración de correo están deshabilitados en estos APK** hasta disponer de un backend por HTTPS. En el PC se pueden probar con Docker. No hay despliegue en AWS. La motivación, los gráficos y el resto de funciones locales siguen disponibles; Pro prepara PDF y Excel para guardar o compartir mediante el selector nativo de Android. Permisos, notificaciones, compartir archivos y Health Connect requieren validación adicional en un teléfono físico.

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

Pro ofrece cuatro apariencias: Dark, Light, Aurora y Sand, con fuentes locales y color personalizable. El botón junto al rango del gráfico alterna área, línea, barras y barras con perspectiva 3D; conserva los mismos datos y los controles para desplazar y ampliar.

En Historial, selecciona registros para **Comparar**. Un registro se compara con el punto de partida; varios usan el primero en orden cronológico como referencia. Se muestran fechas, cambios de peso e IMC, hábitos y diferencias de pasos cuando existen datos. La selección se conserva al filtrar y se indica cuántos seleccionados quedaron fuera de los filtros. El botón Excel permite exportar el mes visible, los filtros actuales o todo el historial; las notas se guardan como texto, nunca como fórmulas.

Los informes PDF de Estadísticas incluyen el historial completo y comparan el rango elegido con el período inmediatamente anterior de igual duración. Presentan peso promedio, hábitos, cobertura de registros y pasos disponibles, además de gráficos y tabla. Respetan idioma, unidad, tema, fuentes y color; la falta de datos no se presenta como un cambio real. PDF y XLSX se generan al solicitarlos, sin almacenarse como archivos en PostgreSQL. Para regenerar muestras PDF con datos ficticios:

```powershell
node scripts/preview-reports.mjs
```

**Pasos en Pro:** Health Connect requiere Android 14 o posterior y permiso de lectura. La app consulta únicamente los últimos 30 días que ya tengan un registro de peso, al abrirse y durante su uso visible; nunca crea pesajes ni ejecuta un servicio permanente de seguimiento. Agrega fuentes mediante Health Connect para evitar dobles conteos y distingue un total cero de la ausencia de datos. El conteo del propio teléfono depende de sus sensores y actualizaciones; en otros dispositivos hace falta una app que escriba pasos en Health Connect. Restaurar un respaldo deja la sincronización desactivada hasta que el usuario vuelva a habilitarla.

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

[Ideas y prioridades de Pro](docs/PRO-ROADMAP.md) · [Servidor local y correo](docs/LOCAL-CLOUD.md) · [Fotografías, fuentes y licencias](ASSETS.md)
