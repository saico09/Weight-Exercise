# Forma · Weight & Exercise

Una app personal para registrar el peso, el ejercicio y la intención de comer sano. Desarrollada con Ionic React, TypeScript y Capacitor, con una vista adaptable al teléfono y al computador. Todo se guarda en el dispositivo, sin cuenta, servidor ni respaldo en la nube.

## Abrir en tu PC

En Windows, haz doble clic en **INICIAR-APP.cmd**. Inicia el servidor local en segundo plano y abre la app en el navegador:

**http://127.0.0.1:5173**

Si Forma ya está abierta, el iniciador reutiliza el servidor. Si otra app ocupa el puerto, muestra un error y no cierra ningún proceso. Para elegir otro puerto:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-preview.ps1 -Port 5174
```

Para iniciar sin abrir el navegador, agrega `-NoBrowser`. El iniciador muestra el PID del servidor y el comando para detenerlo. Los diagnósticos quedan en `.preview-server.log` y `.preview-errors.log`.

En una instalación nueva, primero instala Node.js 22 o superior y ejecuta en la carpeta del proyecto:

```powershell
npm install
```

La dirección del navegador importa: `localhost`, `127.0.0.1` y distintos puertos tienen almacenamientos separados. Usa siempre la misma dirección para conservar tus registros de prueba.

## Qué incluye

- Tema **Dark** con negro, verde `#42FF85` y tipografía contundente; tema **Light** con azul `#91F8FF`, transparencias y tipografía suave.
- Inicio por pasos: tema, altura, peso actual, objetivo y edad.
- Registro diario de peso, ejercicio y la pregunta «¿Toca comer sano hoy?».
- Progreso del peso, avance a la meta y seguimiento de hábitos.
- Estadísticas, promedios semanales y logros.
- IMC con indicador semicircular, categorías y equivalencias en peso.
- Historial editable y selección de un registro como punto de partida.
- Cambio de unidades, preferencias de recordatorios y reinicio de datos.

El IMC es una referencia orientativa y no un diagnóstico. La app muestra categorías adultas desde los 20 años y no calcula percentiles de IMC por edad para menores. Referencia: [categorías de IMC para adultos del CDC](https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html).

## Desarrollo

```powershell
npm run dev       # Servidor de desarrollo
npm run build     # Verificación TypeScript y compilación en dist/
npm run preview   # Servir la compilación de dist/
npm test          # Pruebas automatizadas
npm run android   # Compilar, sincronizar y abrir Android Studio
```

Los scripts ejecutan las herramientas mediante Node directamente para funcionar también cuando la ruta del proyecto contiene `&`. `npm run dev` y `npm run preview` escuchan en todas las interfaces para facilitar pruebas desde otros dispositivos de la red; el iniciador de Windows escucha únicamente en `127.0.0.1`.

## Android

La versión **0.1.0** se compiló y verificó el 14 de octubre de 2026. El APK local está en **[output/Forma-debug.apk](output/Forma-debug.apk)** (5,8 MB), compatible con Android 7.0 o superior.

Para instalarlo, copia ese archivo al teléfono, ábrelo desde el administrador de archivos y pulsa **Instalar**. Si Android lo solicita, permite instalar aplicaciones desde ese administrador de archivos. La app funciona con sus recursos incluidos y no necesita mantener abierta la PC.

Se verificaron la compilación nativa y la firma del APK. Queda pendiente probar esta primera versión en un teléfono físico, especialmente los permisos y la entrega de recordatorios.

El proyecto nativo está en `android/`. Requiere JDK 21 y Android SDK 36; la versión mínima del dispositivo es Android 7.0 (API 24). Para desarrollo habitual, instala Android Studio y su SDK, acepta personalmente las licencias del SDK e instala `platforms;android-36` y `build-tools;36.0.0` desde SDK Manager. Después ejecuta `npm run android`.

También puedes instalar solamente las herramientas de compilación gratuitas, sin Android Studio. Primero lee la [licencia del Android SDK](https://developer.android.com/studio/terms). Si la aceptas, ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-android-sdk.ps1 -AcceptSdkLicense
```

Este script descarga las herramientas oficiales de Google, comprueba su SHA-256 e instala únicamente la plataforma 36, build tools 36 y platform tools dentro de `.tools/android-sdk`. Necesita un JDK 21 instalado; puedes indicar su carpeta con `-JdkHome`. La licencia del SDK es gratuita; no se contratan servicios.

En la primera compilación, Gradle también instala Build Tools 35, requerido por su plugin Android.

Para compilar un APK de prueba desde PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-android.ps1
```

El script busca un JDK 21 instalado y el SDK en `ANDROID_HOME`, `ANDROID_SDK_ROOT`, la ruta habitual de Android Studio o `.tools/android-sdk`. Compila la web, sincroniza Capacitor y ejecuta Gradle con Java directamente para soportar la ruta con `&`. Si ya compilaste la web, puedes agregar `-SkipWebBuild`. Cuando la compilación termine correctamente, el APK se genera en:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

El script verifica la firma y copia el resultado a **`output/Forma-debug.apk`**. Es un APK firmado con una clave de desarrollo para pruebas locales; publicar en una tienda requiere preparar una firma de distribución.

## Datos y notificaciones

En Android, [Capacitor Preferences](https://capacitorjs.com/docs/apis/preferences) guarda los datos localmente en las preferencias privadas de la app. En el navegador utiliza el almacenamiento local del sitio. No hay sincronización entre la PC y el teléfono. La configuración nativa desactiva los respaldos y la transferencia de datos de Android. Eliminar los datos de la app, desinstalarla o borrar los datos del sitio puede eliminar los registros. La opción de reinicio elimina el perfil, los registros y las preferencias de Forma.

En Android, los recordatorios usan notificaciones locales y solicitan permiso cuando eliges activarlos. El sistema puede retrasarlos por ahorro de batería. Si rechazas el permiso, debes habilitarlo desde la configuración del dispositivo antes de activarlos en Forma.

La vista del navegador permite probar la interfaz, pero no sustituye los recordatorios nativos: no puede garantizar avisos con la app o el navegador cerrados.

Las imágenes y sus licencias están documentadas en [ASSETS.md](ASSETS.md).
