# Weight&Exercise · Pro y Basic v0.8

App Android para registrar peso, ejercicio y alimentación, con interfaz adaptable a teléfono y PC. Ionic React, TypeScript y Capacitor. Los registros se guardan primero en el dispositivo; Pro incorpora respaldo manual con cuenta y resúmenes por correo, ejecutados por un servidor Docker local. La versión 0.7 mantiene alineadas las acciones en pantallas pequeñas, unifica las tarjetas de estadísticas, añade foto de perfil y copa en la cabecera, y desbloquea los temas Oro y Platino con los logros. Aurora y Sand incluyen movimiento ambiental discreto.

## Basic y Pro

Las ediciones se mantienen en las ramas **`basic`** y **`pro`**, con dos carpetas de trabajo independientes para ejecutarlas simultáneamente. `src/lib/edition.ts` define la edición de cada rama. Son artefactos separados: Basic elimina las implementaciones Pro de nube, PDF, recuentos y color personalizado, y muestra únicamente vistas promocionales. Su compilación comprueba fuentes, dependencias, permisos y bundle para impedir la reincorporación accidental de esas funciones. No hay un interruptor de edición que las active. Todavía no hay compras ni cobros: el aviso indica «Próximamente en Google Play» hasta disponer de la ficha pública de Pro.

| Funcionalidad | Basic gratuita | Pro |
| --- | --- | --- |
| Registros e historial completo, sin límite de días | Sí | Sí |
| Editar registros, hábitos y punto de partida | Sí | Sí |
| Temas Dark y Light; español e inglés; kg/lb y cm/pies | Sí | Sí |
| Gráfico de peso, meta, IMC y estadísticas esenciales | Sí | Sí |
| Minigráficos en las métricas; expansión al ancho de dos tarjetas | Sí | Sí |
| Logros, copas y celebraciones | Sí | Sí |
| Foto de perfil local y copa en la cabecera | Sí | Sí |
| Temas Oro y Platino obtenidos con logros | Sí | Sí |
| Motivación con foto y mensaje personalizables | Sí | Sí |
| Recordatorio para registrar el peso | Sí | Sí |
| Colores personalizados | — | Sí |
| Temas Aurora y Sand, además de Dark y Light | — | Sí |
| Peso en área, línea o columnas de variación | — | Sí |
| Progreso de la meta con selector 2D/3D | — | Sí |
| Promedios y comparación entre semanas | — | Sí |
| Selección y comparación de registros del historial | — | Sí |
| Exportación Excel (.xlsx) por mes, filtros o historial completo | — | Sí |
| Informes PDF con historial completo y períodos comparados | — | Sí |
| Notificaciones de recuento semanal o mensual | — | Sí |
| Cuenta por código de correo y respaldo manual | — | Prueba local en PC |
| Resumen semanal o mensual por correo con Excel adjunto | — | Opcional, desde el servidor local |
| Pasos de Health Connect en registros existentes | — | Android 14+, pendiente de prueba física |
| Progreso diario de pasos y meta personal ajustable | — | Sí |

El botón **Necesito Motivación** aparece en Inicio y en el editor diario. Abre un gatito con «Hazlo por él»; permite reemplazar la foto y el mensaje. Las fotos se redimensionan y se eliminan sus metadatos en el dispositivo antes de guardarlas. La imagen preparada ocupa como máximo unos 183 KiB.

## Perfil, recompensas y movimiento

Toca «Tú» para elegir, reemplazar o quitar una foto de perfil. La foto se recorta al centro y se convierte localmente en un JPEG de 256×256, sin metadatos y con un límite de 80.000 caracteres. Solo se guarda al confirmar los ajustes; en Pro forma parte del respaldo manual si decides enviarlo. La copa contigua abre Logros.

Las copas generales de Oro (20 logros) y Platino (30) habilitan sus respectivos estilos desde Ajustes → Estilos que te ganas. Son recompensas gratuitas en ambas ediciones y siguen disponibles después de editar el historial. La felicitación al alcanzar el nivel muestra el nuevo tema; nunca cambia el estilo automáticamente. Los desbloqueos locales motivacionales no son licencias de compra.

Aurora y Sand tienen campos de luz de movimiento lento y entradas breves de componentes. Respetan la preferencia de movimiento reducido del sistema; las animaciones no desplazan la distribución ni bloquean controles. Las tarjetas contraídas de estadísticas tienen la misma altura, y al expandir muestran las notas completas.

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

Los APK de prueba de Pro y Basic v0.6 se generan localmente en:

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

Los recordatorios solicitan permiso al activarlos. **Basic y Pro** ofrecen el aviso de registro diario, que se repite a la hora y los días elegidos. **Pro** añade un recuento semanal o mensual con fechas, pesos, diferencia neta y días de ejercicio y alimentación sana. Se necesitan al menos dos registros dentro de los 7 o 30 días anteriores al último pesaje disponible; el texto incluye las fechas reales para no presentar un peso antiguo como si fuera de hoy.

El recuento nativo agenda **un próximo aviso**: el domingo para la frecuencia semanal o el día 1 para la mensual, a la hora elegida. Se recalcula al abrir o volver a la app, al guardar registros y al cambiar su configuración. Puede aparecer con la app cerrada después de programarse, pero no es una serie indefinida: para preparar un aviso posterior hay que volver a abrir o usar la app. El contenido es una instantánea de los datos disponibles al programarlo; no existe un servicio de medición permanente en segundo plano. Android puede retrasar los avisos por ahorro de batería. Los recordatorios programados requieren la app instalada; el navegador solo ofrece una notificación de prueba. Estos avisos locales son independientes de los resúmenes por correo del servidor.

Pro ofrece cuatro apariencias con fuentes locales y color personalizable. Su bienvenida presenta Dark («Beast mode»), Light («Minimalista»), Aurora («smart modern») y Sand («Tranquilidad», con «quiet vibes») con fotografías incluidas en la app, animaciones propias y confirmación de selección. Las imágenes se usan bajo sus licencias documentadas en [ASSETS.md](ASSETS.md). Idioma y personalización comparten una barra compacta; restaurar el color original es una acción visible dentro del selector. Las animaciones respetan la preferencia del dispositivo de reducir movimiento.

Inicio cambia su frase según el tema: «Activa el beast mode», «Tu mejor versión», «Cada paso cuenta» y «Ve a tu ritmo». Basic incorpora las dos primeras con sus temas Dark y Light.

En Pro, el botón junto al rango del gráfico de pesos alterna **área, línea y variación**. La vista de columnas representa diferencias positivas o negativas respecto del primer pesaje del período, con peso y fecha de referencia visibles y una línea de cambio cero. Esa referencia permanece fija al desplazar o ampliar el gráfico. Así se distinguen variaciones pequeñas sin recortar engañosamente columnas de peso absoluto. Los controles de desplazamiento y zoom siguen disponibles. La perspectiva **3D se encuentra en «Tu próxima meta»**, mediante un selector 2D/3D que conserva el mismo porcentaje de avance; ambas preferencias se guardan. La preferencia 3D de versiones anteriores se migra a la tarjeta de la meta.

En Estadísticas, cada tarjeta numérica incluye un minigráfico de sus propios datos. Al tocarla ocupa el ancho de dos tarjetas y el espacio intermedio, amplía el gráfico y muestra fechas y rango de valores; las demás tarjetas se reacomodan. Otro toque la contrae. Esto está disponible en Basic y Pro para sus respectivas métricas; un valor ausente no se convierte en un cero y un único registro no inventa una tendencia.

En Historial, selecciona registros para **Comparar**. Un registro se compara con el punto de partida; varios usan el primero en orden cronológico como referencia. Se muestran fechas, cambios de peso e IMC, hábitos y diferencias de pasos cuando existen datos. Un resumen final presenta los dos pesos, sus fechas y la diferencia neta entre referencia y último registro seleccionado, indicando aumento, descenso o igualdad; no suma las diferencias de las filas. La selección se conserva al filtrar y se indica cuántos seleccionados quedaron fuera de los filtros. El botón Excel permite exportar el mes visible, los filtros actuales o todo el historial; las notas se guardan como texto, nunca como fórmulas.

**Celebraciones de logros, en ambas ediciones:** al guardar un registro que desbloquea logros nuevos aparece una ventana «¡Bien hecho!» con copa, los logros obtenidos y acceso a la colección. Si se consiguen varios con el mismo registro se agrupan en una sola ventana. Los logros ya reconocidos no vuelven a celebrarse al iniciar, actualizar o restaurar un respaldo; siguen visibles en la colección.

Los informes PDF de Estadísticas incluyen el historial completo y comparan el rango elegido con el período inmediatamente anterior de igual duración. Presentan peso promedio, hábitos, cobertura de registros y pasos disponibles, además de gráficos y tabla. Respetan idioma, unidad, tema, fuentes y color; la falta de datos no se presenta como un cambio real. PDF y XLSX se generan al solicitarlos, sin almacenarse como archivos en PostgreSQL. Para regenerar muestras PDF con datos ficticios:

```powershell
node scripts/preview-reports.mjs
```

**Pasos en Pro:** Health Connect requiere Android 14 o posterior y permiso de lectura. La app consulta únicamente los últimos 30 días que ya tengan un registro de peso, al abrirse y durante su uso visible; nunca crea pesajes ni ejecuta un servicio permanente de seguimiento. Agrega fuentes mediante Health Connect para evitar dobles conteos y distingue un total cero de la ausencia de datos. El conteo del propio teléfono depende de sus sensores y actualizaciones; en otros dispositivos hace falta una app que escriba pasos en Health Connect. Restaurar un respaldo deja la sincronización desactivada hasta que el usuario vuelva a habilitarla.

Inicio muestra los pasos de hoy, la meta y su porcentaje de avance. Ajustes permite elegir una meta personal de 100 a 50.000 pasos. Si no se elige una, la app usa **7.000 como referencia orientativa para adultos de 18 años o más**, apoyada en la [revisión de evidencia presentada por la Universidad de Sídney en 2025](https://www.sydney.edu.au/news-opinion/news/2025/07/24/rethink-the-10000-a-day-step-goal-study-suggests.html); no es una recomendación individual ni una regla universal. Para menores no se asigna esa referencia automáticamente. El arco se completa al llegar a la meta, conserva el conteo real si se supera y muestra «—» cuando faltan datos.

El IMC es una referencia, no un diagnóstico. Se muestran categorías adultas desde los 20 años; la app no calcula percentiles para menores. [Referencia del CDC](https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html).

## Migración local de Basic a Pro (v0.8)

Instala ambas ediciones actualizadas en el mismo teléfono. En **Basic → Ajustes → Transferir a Pro**, revisa el resumen y pulsa **Copiar y abrir Pro**. Pro muestra la cantidad de días nuevos, coincidentes y con diferencias antes de **Confirmar importación**. También se puede iniciar la guía desde la bienvenida o Ajustes de Pro, en **Importar desde Basic**.

Se copian perfil/foto, pesos, hábitos, notas, motivación, preferencias compartidas y logros. Basic permanece intacta. En una Pro vacía se adopta el perfil de Basic; si Pro ya tiene perfil se conservan sus preferencias, meta y punto de partida. Los días nuevos se añaden; para los días con diferencias se conserva Pro por defecto y se puede elegir explícitamente usar Basic. Los pasos nativos de Pro se preservan. Repetir una copia no duplica fechas. No se transfieren cuentas, sesiones ni permisos; los recordatorios de una nueva Pro quedan desactivados hasta configurarlos allí. La migración se guarda primero de forma local, sin subir nada automáticamente a la cuenta.

Android usa un Intent explícito entre los paquetes de ambas ediciones y un FileProvider privado, limitado al directorio temporal de migración, con acceso temporal de lectura. Ambos extremos comprueban paquete, versión mínima 8 y firma. Pro valida estrictamente el documento antes de importar: versión de formato, límites, fechas, tipos, duplicados y referencias. El máximo es 4 MiB; la bandeja privada mantiene hasta tres transferencias pendientes, válidas durante 24 horas, y consume cada una al cerrar o terminar su revisión. Los temporales vencidos se limpian al usar el puente. Las operaciones de importación, restauración y reinicio se coordinan; una transferencia entrante espera si hay una edición o confirmación abierta. Se desactivan los logs de Capacitor para evitar registrar cargas de preferencias o transferencias.

**Antes de publicar:** Basic (`cl.forma.weightexercise.basic`) y Pro (`cl.forma.weightexercise`) deben compartir la **clave de firma de distribución de Play App Signing**, no solo la clave de subida. Al registrar la segunda app, elegir reutilizar la clave de firma de la primera. Si Google genera dos claves distintas, el puente rechazará la transferencia. [Firma de aplicaciones en Google Play](https://developer.android.com/studio/publish/app-signing) · [Transferencia segura de archivos entre apps](https://developer.android.com/training/secure-file-sharing).

Para probar en PC: Basic permite descargar `WeightExercise.we-transfer`; en Pro, **Importar desde Basic → Elegir archivo de Basic** abre la misma validación y confirmación. El archivo contiene datos personales y debe guardarse de forma privada. Esta alternativa de archivo solo aparece en la vista web; Android abre Pro directamente. Las pruebas automatizadas cubren formato, conflictos, repetición y protocolo nativo; la entrega entre apps aún requiere una prueba en teléfono/emulador antes de publicar.

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
