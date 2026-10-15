# Autorización de Weight&Exercise Pro

Esta preparación corresponde a una **app Pro pagada y separada en Google Play**, paquete `cl.forma.weightexercise`. No introduce compras dentro de Basic, suscripciones ni un servidor adicional. El acceso por código de correo identifica la cuenta; **no concede Pro**.

## Estado actual

La vista local y los APK de depuración continúan funcionando como previews. La API mantiene su bloqueo `LOCAL_DEVELOPMENT=true`, orígenes locales y puerto publicado únicamente en loopback. No se ha desplegado ni abierto el servidor de AWS. Sin las claves y la configuración de Play, `/api/license/config` indica `configured:false` y los endpoints de activación no emiten licencias de prueba.

Las pruebas sustituyen el decodificador de Google únicamente mediante inyección de dependencias dentro de procesos de test. No existe un endpoint público para enviar veredictos falsos, una contraseña maestra o una opción de cliente que conceda una licencia real.

La compilación Android **release exige automáticamente** una clave pública RSA válida en `WE_LICENSE_PUBLIC_KEY`; Gradle detiene la compilación si falta. La pantalla `ProAccessGate` solicita una cuenta y la verificación nativa de licencia antes de acceder al producto. Revisa el ticket al volver a la app y mientras permanece abierta, y mantiene un acceso independiente para **Guardar mis datos** (JSON local), exportar el respaldo de nube en JSON y gestionar o eliminar la cuenta aunque la licencia haya expirado. El preview web y los APK debug están separados de ese acceso release y no representan una activación de Google Play.

## Flujo de activación

1. El usuario inicia sesión con su correo. El Android oficial crea una clave RSA2048 en Android Keystore; la clave privada no se envía al servidor.
2. `POST /api/license/challenge` recibe la clave pública DER-SPKI codificada en base64url sin padding. Requiere cookie de sesión y `X-WE-Account` con el UUID de esa cuenta.
3. El servidor genera un desafío de cinco minutos. Su `requestHash` SHA-256 une un UUID aleatorio, nonce, cuenta y huella de la clave del dispositivo: `we-pro-v1\n<id>\n<nonce>\n<userId>\n<deviceKeyHash>`.
4. Android pide a Play Integrity un token estándar con ese hash, genera un nonce nativo aleatorio de 32 bytes (`proofNonce`, base64url) y firma `requestHash + '\n' + proofNonce` con `SHA256withRSA`/PKCS#1. Envía `{challengeId,integrityToken,deviceSignature,proofNonce}` a `POST /api/license/verify`.
5. El servidor consume el desafío una sola vez antes de llamar a Google, verifica la firma del dispositivo y solicita a Google la decodificación del token. Comprueba el hash, la fecha reciente, el paquete, la versión mínima, certificados de firma autorizados, `PLAY_RECOGNIZED`, `LICENSED` y `MEETS_DEVICE_INTEGRITY`.
6. Solo entonces firma un ticket RS256 de hasta siete días. Contiene emisor, paquete destinatario, UUID de cuenta, huella de dispositivo, hash del desafío, nonce nativo, plan, versión de protocolo, fechas y un identificador aleatorio. Android verifica la firma con una clave pública fijada en la compilación y la vinculación al dispositivo. El nonce nativo y el hash permiten reconocer una renovación reciente sin reutilizar un ticket viejo para reiniciar su control de reloj.

El flujo utiliza las [solicitudes estándar y su protección de contenido](https://developer.android.com/google/play/integrity/standard) y los [veredictos de integridad y licencia](https://developer.android.com/google/play/integrity/verdicts) documentados por Google. El token de OAuth del servidor usa una [cuenta de servicio](https://developers.google.com/identity/protocols/oauth2/service-account); su clave nunca pertenece al APK.

## Contrato público

Las tres rutas requieren sesión y `X-WE-Account`. Los cuerpos están limitados a 2 KB para el desafío y 40 KB para la verificación. Hay límites por cuenta e IP y un máximo de dos decodificaciones simultáneas. Las respuestas no se almacenan en caché.

| Ruta | Resultado |
| --- | --- |
| `GET /api/license/config` | `{configured,cloudProjectNumber,packageName,offlineDays}`; el número de proyecto es string o null |
| `POST /api/license/challenge` | `{challengeId,requestHash,cloudProjectNumber}` |
| `POST /api/license/verify` | `{ticket,expiresAt}`; la fecha es ISO8601 |

Con `PRO_LICENSE_ENFORCEMENT=true`, `/api/backup` y la activación/envío de resúmenes por correo requieren una licencia vigente de la cuenta. La cuenta sigue pudiendo consultar o apagar sus correos, cambiar su nombre/correo, eliminarse y recuperar sus datos mediante `GET /api/account/export`. Esa exportación devuelve el mismo snapshot que la lectura del respaldo y no permite escribir datos.

Se permiten **tres activaciones de dispositivos por cuenta**. Una cuarta se rechaza y no expulsa las anteriores. El acceso al respaldo es de la cuenta: esta política no equivale a limitar a tres sesiones HTTP. Las cuentas y los datos no se borran cuando una licencia expira.

## Preparación en Google Play

Antes de activar la protección en una distribución pública:

1. Crear la app Pro **de pago** con el identificador definitivo y configurar Play App Signing. Publicar primero en un track de prueba adecuado; una instalación manual de un APK debug no demuestra compra ni instalación reconocida.
2. Vincular el proyecto de Google Cloud a Play Integrity desde Play Console y habilitar su API. Registrar su **número** de proyecto, no su ID textual. Consultar la [configuración oficial de Play Integrity](https://developer.android.com/google/play/integrity/setup).
3. Preparar la cuenta de servicio autorizada para decodificar tokens en ese proyecto. Conservar su JSON fuera de Git, del directorio web y de la imagen Docker; montarlo de solo lectura en el contenedor. El servidor usa exclusivamente los hosts HTTPS fijos de Google y no sigue redirecciones.
4. Copiar las huellas SHA-256 de los certificados de **Play App Signing**, convertidas a base64url sin padding. No usar la huella de la clave de subida. Se admiten hasta cuatro certificados para una rotación controlada.
5. Generar una clave RSA de firma de tickets, de 2048 a 4096 bits, fuera del repositorio. Montar la privada solo en el backend. Incorporar su pública SPKI en `WE_LICENSE_PUBLIC_KEY` durante la compilación Android protegida. Planificar la rotación de esa clave junto con la actualización de los clientes; no reemplazarla sin un plan de transición.
6. Configurar backend HTTPS, cookies seguras, orígenes exactos y acceso del cliente Android en un trabajo de despliegue separado. El guard local actual se conserva deliberadamente y debe adaptarse y revisarse antes de Internet. Este documento **no** indica que el backend local ya sea un despliegue público listo.
7. Activar `PRO_LICENSE_ENFORCEMENT=true` en servidor y compilar Android release, que exige la clave pública automáticamente; probar instalación reconocida, compra válida, reinstalación, renovación, cambio de dispositivo, pérdida de conexión, cuenta sin licencia, reembolso y revocación desde un track real. Consultar también las opciones de [protección automática de Google Play](https://support.google.com/googleplay/android-developer/answer/10183279) disponibles para esa cuenta/app.

No configurar la app Pro como gratuita para luego intentar cambiarla a pagada: Google permite pasar de pago a gratis, pero no ese cambio inverso en la misma ficha. [Precios de apps en Play Console](https://support.google.com/googleplay/android-developer/answer/6334373).

## Configuración privada

`.env.example` enumera únicamente nombres y valores vacíos. El servidor exige todas las opciones de Play al habilitar la protección; una configuración parcial o inválida impide el arranque.

| Variable | Contenido |
| --- | --- |
| `PRO_LICENSE_ENFORCEMENT` | `false` en preview; `true` para exigir licencia en servicios Pro |
| `PLAY_CLOUD_PROJECT_NUMBER` | Número de proyecto vinculado a Play Integrity |
| `PLAY_CERTIFICATE_SHA256` | Huellas base64url de Play App Signing, separadas por coma |
| `PLAY_MIN_VERSION_CODE` | Versión Android mínima aceptada |
| `PRO_LICENSE_OFFLINE_DAYS` | Duración de ticket entre 1 y 7 días |
| `PLAY_SERVICE_ACCOUNT_FILE` | Ruta interna al JSON privado de la cuenta de servicio |
| `PRO_LICENSE_SIGNING_KEY_FILE` | Ruta interna a la privada PEM de firma RS256 |

Usar un override privado de Compose para los dos montajes de archivos. Los ejemplos no contienen claves y `compose.yaml` no añade un volumen con acceso general al host. Los archivos deben ser legibles únicamente por el administrador y el usuario del servicio.

## PostgreSQL y recursos

`server/db/06-pro-licenses.sql` es una migración idempotente y aditiva. Crea desafíos temporales, dispositivos autorizados y bloqueos administrativos, con referencias `ON DELETE CASCADE` a la cuenta. No toca el historial del usuario. `scripts/start-local-cloud.ps1` la aplica al iniciar el entorno local.

No se incorporan nuevas dependencias de Node ni servicios: se usa `node:crypto`, `fetch` y el pool existente de tres conexiones. Los desafíos vencidos se limpian cada minuto; los tokens de acceso a Google se comparten temporalmente en memoria. Continúan los límites de memoria de 256 MB para PostgreSQL y 192 MB para API; Mailpit es una utilidad local adicional de 64 MB. Esas son cotas, no una medición de consumo ni una reserva para los otros servicios del servidor de 1,15 GB disponibles.

### Actualización local realizada el 15 de octubre de 2026

La migración 06 ya está aplicada a la base local `weight_exercise`; se comprobaron las tres tablas nuevas. La imagen Docker API está construida, pero **el contenedor API que continúa corriendo conserva la versión anterior**. No se ha reiniciado para evitar activar de nuevo su programador con correo real. La configuración de envío no se ha leído ni modificado y no se ha enviado ningún correo durante estas comprobaciones.

Para volver a aplicar únicamente la migración de forma idempotente, sin leer `.env.local`, reiniciar API ni enviar correos:

```powershell
Get-Content -LiteralPath 'server/db/06-pro-licenses.sql' -Raw |
    docker exec -i weight-exercise-local-db-1 psql -v ON_ERROR_STOP=1 -U postgres -d weight_exercise
```

En el siguiente inicio manual, desde la raíz del proyecto, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-cloud.ps1 -NoBrowser` reconstruye/actualiza API y vuelve a aplicar las migraciones. Ese inicio utiliza el modo de correo privado ya configurado: si es SMTP real, puede reanudar los resúmenes consentidos pendientes. Las pruebas de integración que crean correos deben ejecutarse con Mailpit; las pruebas de licencia no requieren activar el programador ni reiniciar API.

## Revocación administrativa

Desde una consola de administrador del backend, con la conexión PostgreSQL ya configurada:

```text
node scripts/revoke-pro.mjs <UUID-de-cuenta> <huella-de-dispositivo>
node scripts/revoke-pro.mjs <UUID-de-cuenta>
```

La primera retira un dispositivo; la segunda bloquea todas las futuras activaciones de esa cuenta. No hay endpoint administrativo expuesto a la app. Una revocación de cuenta detiene los servicios Pro del servidor; el acceso local ya concedido puede durar hasta el vencimiento del ticket, como máximo siete días. Las filas revocadas se conservan para impedir que la misma clave se reactive. Soporte puede revisar y retirar esos bloqueos en una operación administrativa posterior.

## Pruebas y límites

```powershell
cd server
npm test
$env:RUN_LICENSE_DB_TESTS='1'
node --test test/pro-license-database.test.mjs
```

La prueba de PostgreSQL crea y elimina su propia base temporal en el contenedor local; aplica la migración dos veces y comprueba idempotencia, replays simultáneos, aislamiento entre cuentas, rechazo de firmas/veredictos inválidos, expiración, límite concurrente de tres activaciones y revocación. Nunca crea un mailer ni envía correos. Las comprobaciones unitarias de Google usan respuestas simuladas; **no sustituyen una prueba real desde Google Play**.

Ninguna protección de una app instalada en el dispositivo impide el 100 % de modificaciones o redistribuciones. Keystore, Play Integrity, firma del ticket y validación en el servidor dificultan copiar el APK/ticket y mantienen protegidos los servicios de nube. Un cliente profundamente modificado podría omitir funciones de bloqueo locales; no hay una garantía absoluta de DRM.

`LICENSED` no expone la identidad de la cuenta de Google ni un ID de compra de la app pagada. Por ello no se presenta como una correspondencia uno a uno entre compra y correo de Weight&Exercise. Reembolsos/cambios de licencia se detectan al renovar con Google; los tickets offline no se revocan instantáneamente. El plazo de siete días es una decisión inicial que puede reducirse antes de publicar.
