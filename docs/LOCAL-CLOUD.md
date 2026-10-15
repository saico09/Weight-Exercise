# Nube local Pro · Weight&Exercise

Esta implementación se ejecuta solamente en el PC. No conecta con AWS, no abre PostgreSQL a Internet y no envía correos reales. Basic funciona sin cuenta y sin estos servicios.

## Encender y revisar

Requiere Docker Desktop con el motor Linux listo y Node.js 24 para ejecutar las pruebas fuera del contenedor.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-cloud.ps1 -NoBrowser
```

El script genera tres secretos aleatorios en `.env.local` la primera vez. Git ignora ese archivo. No cambies sus contraseñas después de crear el volumen sin migrar primero las credenciales de PostgreSQL. Ninguno lleva el prefijo `VITE_`; no se incorpora al JavaScript de la app.

- Pro usa `/api` a través del proxy Vite. El servicio está en [127.0.0.1:3001](http://127.0.0.1:3001/api/health).
- [Mailpit](http://127.0.0.1:8025) muestra los códigos de acceso enviados durante esta prueba. Puedes utilizar un correo con formato válido: todo queda aquí, sin envío externo.
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

## Contrato de la API

Todas las solicitudes con cuerpo usan JSON. Los errores tienen `{ "error": { "code": "...", "message": "..." } }`. Códigos: `invalid_input`, `invalid_code`, `unauthorized`, `forbidden`, `conflict`, `account_changed`, `rate_limited`, `unavailable`.

| Método/ruta | Cuerpo o respuesta |
|---|---|
| GET `/api/health` | `{ok, localDevelopment, edition}` |
| GET `/api/account` | `{user: null \| {id,email,username}, localDevelopment:true}` |
| POST `/api/auth/request-code` | `{email}`; respuesta genérica, sin revelar si existe cuenta |
| POST `/api/auth/verify-code` | `{email,code,username?}`; crea usuario si no existe; devuelve `{user}` y cookie |
| POST `/api/auth/logout` | `{}`; invalida la sesión |
| PATCH `/api/account` | `{username}`; 3–30 letras, números, guiones o guiones bajos |
| POST `/api/account/email/request` | `{email}`; envía ambos códigos |
| POST `/api/account/email/verify` | `{email,currentCode,newCode}`; devuelve `{user}` y nueva cookie |
| DELETE `/api/account` | `{confirmation:"DELETE"}` |
| GET `/api/backup` | `{revision,updatedAt,data:null\|AppData}` |
| PUT `/api/backup` | `{revision,data:AppData}`; devuelve nueva `{revision,updatedAt}` |

`AppData` conserva kilogramos/centímetros y fechas de calendario. Los registros se guardan en columnas normales; preferencias, perfil y metadatos pequeños usan JSONB. La personalización de la motivación forma parte de las preferencias.

## Pruebas

```powershell
npm --prefix server test
$env:RUN_CLOUD_INTEGRATION='1'
node --test server/test/integration.test.mjs
Remove-Item Env:RUN_CLOUD_INTEGRATION
node server/scripts/measure-local.mjs
```

Las pruebas de integración crean cuentas aisladas `qa_*@example.test`, verifican sesión, aislamiento de usuarios, código de un uso, caducidad, bloqueo por intentos, conflictos simultáneos, cambio de correo, guardia de cuenta entre pestañas y eliminación en cascada. Solo eliminan las cuentas que crean. La prueba de carga también crea y elimina sus propias cuentas. Usa el buzón de desarrollo, nunca correos externos. Ejecutarlas repetidamente puede activar los límites de la API; espera a que venza la ventana antes de repetirlas.

## Antes de llevarlo a AWS

No se ha desplegado ni modificado el servidor de AWS. Esta API se niega a arrancar sin `LOCAL_DEVELOPMENT=true` y solo admite orígenes loopback. Es una protección deliberada contra publicar por accidente el prototipo.

Para un despliegue real hay que preparar una configuración separada: HTTPS y cookies `Secure`, dominio/orígenes reales, SMTP transaccional con SPF/DKIM/DMARC, verificación de la compra Pro en Google Play, recuperación de cuentas, adaptación y prueba de sesiones en el WebView Android, protección de datos/copias de seguridad, monitorización y una revisión de seguridad. Mailpit no se instala en producción. La guardia de cuenta del cliente debe exigirse también en el servidor al formalizar el contrato de producción. El proxy inverso debe definir qué IP de origen es confiable para los límites; no se deben aceptar cabeceras de IP arbitrarias.

Mantén una base/rol independientes de otras apps, sin puerto público 5432. Se puede compartir **un solo motor PostgreSQL** con otras bases si el consumo medido lo permite; no es necesario instalar un servidor PostgreSQL por aplicación. Deben revisarse primero los servicios que ya corren en Lightsail y dejar margen al sistema operativo.

Para una copia administrativa manual local, sin corromper el archivo binario al pasarlo por PowerShell:

```powershell
docker compose --env-file .env.local exec -T db pg_dump -U postgres -Fc -f /tmp/weight-exercise.dump weight_exercise
docker compose --env-file .env.local cp db:/tmp/weight-exercise.dump ./output/weight-exercise.dump
```

Ese archivo contiene datos privados. Guárdalo protegido fuera de Git. Antes de producción se debe automatizar una retención limitada y comprobar la restauración en una base separada.

Referencias oficiales: [memoria de PostgreSQL](https://www.postgresql.org/docs/17/runtime-config-resource.html), [pool de node-postgres](https://node-postgres.com/features/pooling), [opciones de Mailpit](https://mailpit.axllent.org/docs/configuration/runtime-options/), [SMTP de Nodemailer](https://nodemailer.com/smtp), [autenticación OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [sesiones OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
