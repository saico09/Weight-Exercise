# Nube local Pro · Weight&Exercise

Esta implementación se ejecuta solamente en el PC. No conecta con AWS ni abre PostgreSQL a Internet. Basic funciona sin cuenta y sin estos servicios. El correo tiene dos modos: `mailpit` para pruebas sin envíos externos y `real` para SMTP autenticado con TLS, configurado privadamente por el dueño.

## Encender y revisar

Requiere Docker Desktop con el motor Linux listo y Node.js 24 para ejecutar las pruebas fuera del contenedor.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-cloud.ps1 -NoBrowser
```

El script genera tres secretos aleatorios en `.env.local` la primera vez. Git ignora ese archivo. No cambies sus contraseñas después de crear el volumen sin migrar primero las credenciales de PostgreSQL. Ninguno lleva el prefijo `VITE_`; no se incorpora al JavaScript de la app.

- Pro usa `/api` a través del proxy Vite. El servicio está en [127.0.0.1:3001](http://127.0.0.1:3001/api/health).
- En modo `mailpit`, [Mailpit](http://127.0.0.1:8025) muestra códigos y resúmenes sin enviarlos a Internet. En modo `real`, llegan al correo indicado por el usuario y la app oculta el enlace al buzón de pruebas.
- PostgreSQL no publica ningún puerto. Solo la API accede a la red interna de la base.
- Los servicios se reinician con Docker y conservan los datos en el volumen `weight-exercise-local_database`.

Para detenerlos conservando los datos:

```powershell
docker compose --env-file .env.local stop
```

Para consultar estado y consumo:

```powershell
docker compose --env-file .env.local ps
docker stats --no-stream weight-exercise-local-db-1 weight-exercise-local-api-1 weight-exercise-local-mailpit-1
```

## Diseño para poca RAM

El presupuesto futuro informado es **1,15 GB de RAM disponible** y **54 GB de disco libre**. Se eligieron PostgreSQL y una API Node pequeña, sin plataforma de administración pesada ni ORM. Mailpit existe exclusivamente para el desarrollo local.

| Servicio | Límite de memoria | Configuración |
|---|---:|---|
| PostgreSQL 17 Alpine | 256 MiB | `shared_buffers=64MB`, `work_mem=2MB`, mantenimiento/autovacuum 16 MB, 20 conexiones máximas, 1 worker de autovacuum, consultas sin workers paralelos |
| API Node 24 Alpine | 192 MiB | Pool de 3 conexiones, heap de V8 limitado a 96 MB, cuerpo HTTP máximo 2,1 MB, máximo 16 solicitudes en curso y 8,4 MB de cuerpos pendientes |
| Mailpit local | 64 MiB | 50 mensajes como máximo, retención de 24 horas, sin reenvío SMTP |

Los límites suman **512 MiB**, incluyendo el buzón de desarrollo; PostgreSQL y API suman **448 MiB**. No equivalen a una reserva permanente. `work_mem` se aplica por operación, por lo que no debe incrementarse multiplicándolo por el número de usuarios. El límite del contenedor es la barrera final; una carga excesiva aún puede terminar procesos y requiere observar el servidor real.

Medición en Docker Desktop de este PC el 15 de octubre de 2026:

| Escenario | PostgreSQL | API | Mailpit | Total aproximado |
|---|---:|---:|---:|---:|
| Inicio, sin cuentas | 56,81 MiB | 23,85 MiB | 8,15 MiB | 89 MiB |
| Cinco usuarios simultáneos | 65,25 MiB | 36,21 MiB | 25,68 MiB | 127 MiB |

La prueba de cinco usuarios realizó 20 respaldos y 100 lecturas; cada cuenta tenía 730 registros y una imagen sintética de 200 KB. Las operaciones terminaron en aproximadamente 2,76 segundos. Es una prueba pequeña local, **no una estimación garantizada de concurrencia en Lightsail**. Los datos sintéticos se eliminaron al terminar.

Las imágenes locales medidas ocupaban aproximadamente 117 MB (PostgreSQL), 64 MB (API) y 14 MB (Mailpit), aparte del volumen, caché de Docker y capas compartidas. La base rondaba 10 MB después de las pruebas; el WAL y los respaldos ocupan espacio adicional. `max_wal_size=256MB` es un objetivo de checkpoints, no una cuota absoluta de disco. Los logs rotan a 2 archivos de 5 MB por servicio. Los códigos, sesiones y contadores vencidos se purgan cada minuto. El respaldo admite 2 MB y hasta 36.600 registros por cuenta. Para muchos usuarios, las fotos y las copias de seguridad son el primer aspecto que conviene vigilar.

## Acceso, cuentas y respaldo

El acceso por código de correo es **autenticación sin contraseña de un factor**, no 2FA. No se almacena contraseña. Para un segundo factor real se puede añadir posteriormente una passkey o un autenticador.

- Códigos de 6 dígitos generados con `crypto.randomInt`, caducidad de 10 minutos, un solo uso y máximo 5 intentos. Se guarda un HMAC con sal aleatoria y secreto separado de la base, nunca el código sin protección.
- Límites persistentes de envío y verificación por correo/IP; espera de 45 segundos entre envíos. La API local no confía en `X-Forwarded-For` del cliente.
- Sesiones aleatorias de 256 bits; solo su hash se almacena en la base. Cookie `HttpOnly`, `SameSite=Strict`, limitada a `/api`, con vencimiento de 7 días y máximo 8 sesiones por usuario.
- Se comprueba `Origin` en todas las operaciones que modifican datos. Las consultas SQL usan parámetros. La app envía `X-WE-Account` para impedir que una pestaña con información antigua actúe sobre otra cuenta cuya cookie cambió.
- Cambiar correo exige **dos códigos separados**: uno al correo actual y otro al nuevo. Cuando se completa, se revocan las sesiones anteriores.
- Cada registro, preferencia y respaldo se identifica por el usuario autenticado; el cliente no elige el dueño de una consulta.
- El respaldo es manual. Guardar usa una transacción y una revisión optimista; una revisión antigua recibe 409 y no pisa una copia más reciente. Leer obtiene preferencias y registros de la misma revisión.
- Eliminar la cuenta elimina sus preferencias, registros y sesiones mediante claves foráneas. Es distinto de resetear los datos locales del teléfono.

Tablas: `users`, `user_preferences`, `weight_records`, `sessions`, `auth_challenges`, `rate_limits`. El rol `we_app` no es superusuario y no puede crear bases, roles ni tablas. Las migraciones usan el rol administrativo local por separado.

## Resúmenes por correo y SMTP real (v0.5)

En Estadísticas → Informes Pro, el control **Correo** permite optar por un resumen semanal o mensual con horario y zona horaria propios. La programación siempre empieza desactivada. Requiere una cuenta verificada, un respaldo con registros y consentimiento explícito: el Excel incluye **todos** los registros respaldados, con notas y pasos disponibles. No sube automáticamente información del teléfono; para incluir datos recientes hay que actualizar el respaldo desde Ajustes.

El mensaje resume el período anterior y adjunta un `.xlsx` válido con las hojas Resumen y Registros, colores del tema y unidades. Las notas se exportan como texto, nunca como fórmulas. Cada entrada del ZIP se comprime directamente con `node:zlib`, sin crear otra copia completa del Excel ni añadir dependencias. En Linux, dentro del contenedor limitado a 192 MiB, una prueba de **21.600 registros completos** (respaldo de 1,90 MB) produjo un XLSX de **743 KB**, con **130 MiB de RSS máximo y 26 MiB de heap al terminar**. La API permaneció activa en el mismo contenedor durante la prueba, con aproximadamente 24 MiB adicionales, sin terminar por falta de memoria. Esta medición deja margen para ese caso, pero no garantiza capacidad bajo cualquier carga simultánea. La API procesa un solo informe a la vez y no recorta el historial para construir el adjunto.

La programación durable usa únicamente PostgreSQL (`email_preferences` y `email_deliveries`), sin Redis ni otro contenedor. El worker consulta cada minuto, reclama tareas con `FOR UPDATE SKIP LOCKED`, guarda una concesión temporal y reintenta errores con espera progresiva hasta cinco intentos. Al reiniciar recupera tareas pendientes. Después de una interrupción larga envía como máximo un resumen de recuperación por programación, no todos los períodos omitidos. El envío necesita que el PC y Docker sigan encendidos hasta que exista un servidor desplegado.

Los envíos SMTP no ofrecen una transacción común con PostgreSQL: si el proceso se detiene justo después de que el proveedor acepte un mensaje y antes de registrar el éxito, un reintento podría duplicarlo. Se conserva el mismo `Message-ID` para ese trabajo. La baja cancela pendientes; un correo que el proveedor ya aceptó puede terminar de llegar.

Cada correo incluye un enlace de baja firmado. Abrirlo muestra una confirmación y no cambia la configuración; confirmar por POST desactiva los resúmenes. También admite la baja de un clic de proveedores de correo. Reactivar genera un nuevo identificador e invalida enlaces antiguos. Se pueden desactivar siempre desde la app. Con `PUBLIC_APP_URL` local, el enlace abre únicamente en el PC donde corre la app; para enlaces utilizables desde cualquier teléfono hace falta el despliegue HTTPS.

Variables privadas de SMTP en `.env.local` (plantilla sin secretos en `server/smtp.private.example`):

| Variable | Uso |
|---|---|
| `SMTP_MODE` | `mailpit` (predeterminado) o `real` |
| `SMTP_HOST`, `SMTP_PORT` | Proveedor SMTP; por ejemplo Gmail con puerto 465 |
| `SMTP_SECURE` | `true` para TLS implícito, especialmente puerto 465 |
| `SMTP_REQUIRE_TLS` | STARTTLS obligatorio si `SMTP_SECURE=false`; no se permite correo externo sin TLS |
| `SMTP_USER`, `SMTP_PASS` | Usuario y contraseña de aplicación guardados solamente en el archivo privado |
| `SMTP_FROM` | Dirección del remitente, opcionalmente `Nombre <dirección>`; una sola dirección |
| `PUBLIC_APP_URL` | Origen de la app para enlaces; HTTPS o loopback local |

En modo `mailpit` se ignoran las credenciales reales que estén preparadas. En modo `real` se validan certificados y autenticación, sin debug SMTP ni logs de contenido. Una configuración incompleta o insegura falla sin recurrir silenciosamente a Mailpit. La API verifica la conexión al iniciar. Para comprobarla de nuevo **sin enviar mensajes**:

```powershell
docker compose --env-file .env.local exec -T api node src/verify-smtp.mjs
```

Después de cambiar el modo o las credenciales, recrea solo la API:

```powershell
docker compose --env-file .env.local up -d --no-deps --wait api
```

Antes de activar SMTP real, finaliza las pruebas y confirma que no queden suscripciones de cuentas de prueba. Nunca ejecutes pruebas con correos inventados contra SMTP real. Los scripts de integración y carga rechazan ese modo deliberadamente.

## Contrato de la API

Todas las solicitudes con cuerpo usan JSON. Los errores tienen `{ "error": { "code": "...", "message": "..." } }`. Códigos: `invalid_input`, `invalid_code`, `unauthorized`, `forbidden`, `conflict`, `account_changed`, `rate_limited`, `unavailable`.

| Método/ruta | Cuerpo o respuesta |
|---|---|
| GET `/api/health` | `{ok, localDevelopment, edition, mailMode}` |
| GET `/api/account` | `{user: null \| {id,email,username}, localDevelopment:true, mailMode}` |
| POST `/api/auth/request-code` | `{email}`; respuesta genérica, sin revelar si existe cuenta |
| POST `/api/auth/verify-code` | `{email,code,username?}`; crea usuario si no existe; devuelve `{user}` y cookie |
| POST `/api/auth/logout` | `{}`; invalida la sesión |
| PATCH `/api/account` | `{username}`; 3–30 letras, números, guiones o guiones bajos |
| POST `/api/account/email/request` | `{email}`; envía ambos códigos |
| POST `/api/account/email/verify` | `{email,currentCode,newCode}`; devuelve `{user}` y nueva cookie |
| DELETE `/api/account` | `{confirmation:"DELETE"}` |
| GET `/api/backup` | `{revision,updatedAt,data:null\|AppData}` |
| PUT `/api/backup` | `{revision,data:AppData}`; devuelve nueva `{revision,updatedAt}` |
| GET `/api/email-summary` | Configuración, próximo envío, último envío, fecha/cantidad del respaldo y `mailMode` |
| PUT `/api/email-summary` | `{enabled:false}` o `{enabled:true,consent:true,cadence,timezone,time,weekday,monthDay}` |
| GET/POST `/api/email-summary/unsubscribe?token=...` | Confirmación/baja mediante token firmado; no permite acceder a registros |

`AppData` conserva kilogramos/centímetros y fechas de calendario. Los registros se guardan en columnas normales; preferencias, perfil y metadatos pequeños usan JSONB. La personalización de la motivación forma parte de las preferencias.

## Pruebas

```powershell
npm --prefix server test
$env:RUN_CLOUD_INTEGRATION='1'
node --test server/test/integration.test.mjs server/test/email-integration.test.mjs
Remove-Item Env:RUN_CLOUD_INTEGRATION
node server/scripts/measure-local.mjs
```

Las pruebas de integración crean cuentas aisladas `qa_*@example.test` y `emailqa_*@example.test`, verifican sesión, aislamiento de usuarios, código de un uso, caducidad, bloqueo por intentos, conflictos simultáneos, cambio de correo, guardia de cuenta entre pestañas y eliminación en cascada. También verifican consentimiento, programación con cambio de hora, recuperación del worker, idempotencia del trabajo, XLSX completo/comprimido, baja y revocación de enlaces antiguos. Solo eliminan las cuentas que crean. La prueba de carga también crea y elimina sus propias cuentas. Usa el buzón de desarrollo, nunca correos externos. Ejecutarlas repetidamente puede activar los límites de la API; espera a que venza la ventana antes de repetirlas.

La regresión de concurrencia de la baja usa PostgreSQL real y una cuenta temporal, sin ejecutar el worker ni enviar correos; puede comprobarse también con SMTP real configurado:

```powershell
$env:RUN_CLOUD_DB_TESTS='1'
node --test server/test/email-database-concurrency.test.mjs
Remove-Item Env:RUN_CLOUD_DB_TESTS
```

Las transacciones que cambian la programación o crean/finalizan entregas bloquean primero el usuario y después sus preferencias. La baja comprueba la versión del enlace dentro de esa transacción para impedir que un enlace antiguo desactive una suscripción recién reactivada.

## Antes de llevarlo a AWS

No se ha desplegado ni modificado el servidor de AWS. Esta API se niega a arrancar sin `LOCAL_DEVELOPMENT=true` y solo admite orígenes loopback. Es una protección deliberada contra publicar por accidente el prototipo.

Para un despliegue real hay que preparar una configuración separada: HTTPS y cookies `Secure`, dominio/orígenes reales, proveedor de correo adecuado al volumen con SPF/DKIM/DMARC, verificación de la compra Pro en Google Play, recuperación de cuentas, adaptación y prueba de sesiones en el WebView Android, protección de datos/copias de seguridad, monitorización y una revisión de seguridad. SMTP real puede usarse desde este PC, pero eso no publica la API ni convierte Gmail personal en una plataforma de envío masivo. Mailpit no se instala en producción. La guardia de cuenta del cliente debe exigirse también en el servidor al formalizar el contrato de producción (los endpoints nuevos de programación ya la exigen). El proxy inverso debe definir qué IP de origen es confiable para los límites; no se deben aceptar cabeceras de IP arbitrarias.

Mantén una base/rol independientes de otras apps, sin puerto público 5432. Se puede compartir **un solo motor PostgreSQL** con otras bases si el consumo medido lo permite; no es necesario instalar un servidor PostgreSQL por aplicación. Deben revisarse primero los servicios que ya corren en Lightsail y dejar margen al sistema operativo.

Para una copia administrativa manual local, sin corromper el archivo binario al pasarlo por PowerShell:

```powershell
docker compose --env-file .env.local exec -T db pg_dump -U postgres -Fc -f /tmp/weight-exercise.dump weight_exercise
docker compose --env-file .env.local cp db:/tmp/weight-exercise.dump ./output/weight-exercise.dump
```

Ese archivo contiene datos privados. Guárdalo protegido fuera de Git. Antes de producción se debe automatizar una retención limitada y comprobar la restauración en una base separada.

Referencias oficiales: [memoria de PostgreSQL](https://www.postgresql.org/docs/17/runtime-config-resource.html), [pool de node-postgres](https://node-postgres.com/features/pooling), [opciones de Mailpit](https://mailpit.axllent.org/docs/configuration/runtime-options/), [SMTP de Nodemailer](https://nodemailer.com/smtp), [autenticación OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [sesiones OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
