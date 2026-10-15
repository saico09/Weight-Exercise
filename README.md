# Weight&Exercise · Basic v0.8

Esta carpeta corresponde a la rama **`basic`**. Su vista local usa el puerto **5174** y su APK tiene el identificador `cl.forma.weightexercise.basic`. Es una app Android gratuita de registro de peso, ejercicio y alimentación, con datos guardados en el propio dispositivo. No necesita cuenta ni servidor.

## Novedades

- Los controles de Inicio mantienen su ubicación en pantallas pequeñas. Las tarjetas de estadísticas tienen dimensiones uniformes mientras están contraídas; al tocarlas se amplían al ancho de dos columnas y las siguientes se reacomodan.
- Foto de perfil personalizable y copa actual junto a «Tú». La imagen se prepara en el dispositivo antes de guardarse.
- Los logros de Oro y Platino desbloquean sus temas especiales en **Basic y Pro**, sin compra. Son recompensas por constancia, distintas de los temas comerciales de Pro.
- Algunas opciones Pro se muestran como vistas informativas bloqueadas: informes, colores, estilos Aurora/Sand, recuentos y cuenta/pasos. Al tocarlas se explica que Pro es una app independiente y que estará disponible en Google Play. No hay compras, precios ni enlaces de tienda simulados.

## Llevar tus datos a Pro (v0.8)

Mantén ambas apps actualizadas e instaladas en el mismo teléfono. En **Ajustes → Transferir a Pro**, revisa el recuento y pulsa **Copiar y abrir Pro**. Pro mostrará lo recibido y pedirá confirmar. Basic no borra ni cambia sus datos. La copia incluye perfil/foto, registros, hábitos, notas, motivación, preferencias compartidas y logros; no necesita cuenta ni internet. Los permisos y sesiones no se transfieren.

Si ya hay registros en Pro, se combinan por fecha sin duplicarlos. Se conservan los registros de Pro en días con diferencias salvo que el usuario elija los de Basic. Si Pro ya tiene perfil, conserva su perfil, preferencias y meta. Basic incluye únicamente el exportador y puente de envío: el importador y la combinación de datos viven en la rama Pro.

Para probar en PC se descarga `WeightExercise.we-transfer` desde el mismo diálogo y se selecciona en **Pro → Importar desde Basic**. El archivo contiene datos personales; guárdalo de forma privada. En Android se abre Pro directamente mediante un permiso temporal y un proveedor de archivos privado, sin selector de otras apps ni almacenamiento público. Límite: 4 MiB. No hay un botón de compra hasta publicar Pro.

**Publicación:** ambas apps deben compartir la clave de **Play App Signing** (la firma instalada, no basta compartir la clave de subida), y tener versión 0.8 o posterior. Al configurar la segunda app en Google Play, reutiliza la clave de firma de la primera. De lo contrario, la comprobación de firmas rechazará la migración. [Documentación de firma](https://developer.android.com/studio/publish/app-signing). La compilación y las pruebas del protocolo están verificadas; aún falta probar la entrega entre ambas apps en un teléfono o emulador.

## Una separación real de ediciones

Basic y Pro se desarrollan en ramas y carpetas independientes. Basic **no incluye** el código de cuenta/respaldo, servidor, correo, informes PDF/Excel, recuentos de progreso, Health Connect, gráficos 3D ni selector de colores personalizados. Tampoco incluye sus dependencias nativas o de exportación. Cambiar una preferencia o un indicador de edición no activa esas funciones: los botones solo abren una descripción de la app Pro.

`npm run build` comprueba esta separación antes y después de compilar. `scripts/check-basic-boundary.mjs` rechaza módulos, dependencias, permisos y marcadores de ejecución Pro en el código y en el resultado web. Es una defensa contra empaquetar accidentalmente funciones de pago; no pretende impedir que alguien modifique por completo un APK.

Las preferencias antiguas de color personalizado y recuentos se ignoran al cargar datos Basic. Los recordatorios diarios y la personalización del motivo siguen funcionando con normalidad.

## Incluido en Basic

- Registros e historial sin límite de días; edición de peso, ejercicio, alimentación y punto de partida.
- Dark y Light, más los estilos Oro/Platino al conseguir sus copas.
- Español e inglés; kg/lb y cm/pies.
- Gráfico de peso, avance hacia la meta, IMC y cuatro estadísticas esenciales con mini gráficos y expansión.
- Logros, copas y felicitaciones al desbloquear hitos nuevos.
- Perfil con foto y motivación con imagen y mensaje personalizables.
- Recordatorio para registrar el peso en Android.

Los días sin registro no se cuentan como descanso. Los gráficos no inventan mediciones ni sustituyen las ausencias por cero.

## Abrir la app en el PC

Requisito: Node.js 22 o superior.

```powershell
npm install
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-preview.ps1 -Port 5174
```

Abre [Basic en este PC](http://127.0.0.1:5174/). También puedes ejecutar `INICIAR-APP.cmd`. El iniciador reutiliza una vista existente del proyecto y conserva los procesos ajenos; `-NoBrowser` evita abrir el navegador. Los diagnósticos quedan en `.preview-server.log` y `.preview-errors.log`.

Para abrir ambas ediciones usa `scripts/start-both.ps1` **desde la rama Pro**, indicando la carpeta de Basic. El servidor de cuenta y respaldo se administra exclusivamente desde Pro; esta rama no contiene infraestructura Docker.

Mantén la misma dirección en tus pruebas: `localhost`, `127.0.0.1` y distintos puertos tienen almacenamientos separados. Basic y Pro tampoco mezclan sus historiales.

## Android instalable

El proyecto usa Ionic React, TypeScript y Capacitor. Requiere JDK 21 y Android SDK 36; admite Android 7.0 (API 24) o superior. Para preparar las herramientas oficiales gratuitas, tras leer y aceptar la [licencia del SDK](https://developer.android.com/studio/terms):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-android-sdk.ps1 -AcceptSdkLicense
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-android.ps1
```

El script compila la web, sincroniza los plugins de Basic y genera `android/app/build/outputs/apk/debug/app-debug.apk`, con una copia en `output/WeightExercise-debug.apk`. La entrega se identifica como `WeightExercise-Basic-debug.apk`. Es una compilación firmada para desarrollo, todavía sin publicar en Google Play.

Copia el APK al teléfono y ábrelo desde su administrador de archivos. Permite la instalación desde ese administrador si Android lo solicita. Las fotos y fuentes incluidas funcionan sin la PC. Basic y Pro pueden instalarse juntas y mantienen datos independientes. Para conservar tu historial, actualiza con la misma firma sin desinstalar.

## Datos y recordatorios

En Android, Capacitor Preferences guarda los datos en las preferencias privadas de la app; el navegador usa almacenamiento del sitio. El respaldo y la transferencia automática de Android están desactivados. Borrar datos, desinstalar o limpiar el almacenamiento del sitio puede eliminar los registros: Basic no tiene respaldo en la nube.

Las fotos de perfil y motivación se redimensionan y se vuelven a codificar localmente, descartando los metadatos originales. Elegirlas no envía el archivo a un servidor.

El permiso de notificaciones se pide al activar el recordatorio. Los avisos programados funcionan en Android y pueden retrasarse por ahorro de batería. La vista web solo permite una prueba explícita del navegador; no garantiza avisos con la app cerrada. Basic no programa recuentos semanales o mensuales.

El IMC es una referencia, no un diagnóstico. Se muestran categorías adultas desde los 20 años; no se calculan percentiles para menores. [Referencia del CDC](https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html).

## Desarrollo

```powershell
npm run dev       # Vista de desarrollo en 5174
npm run build     # Verificación de edición, TypeScript y compilación web
npm run preview   # Servir dist/
npm test          # Pruebas de las funciones Basic
npm run android   # Compilar, sincronizar y abrir Android Studio
```

Los comandos usan Node directamente para admitir rutas con `&`. `npm run dev` y `npm run preview` escuchan en la red local; los iniciadores de Windows escuchan solo en `127.0.0.1`.

[Fotografías y licencias](ASSETS.md) · [Ideas de la edición Pro](docs/PRO-ROADMAP.md)
