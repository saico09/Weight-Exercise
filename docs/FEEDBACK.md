# Sugerencias y protección contra spam

Basic y Pro incluyen **Ajustes → Enviar sugerencias**. El usuario escribe una
idea de 20 a 2.000 caracteres, puede indicar un correo de respuesta y completa
una comprobación sencilla. No se adjuntan registros, peso, fotos, nombre de
usuario, sesiones ni respaldos. El correo de respuesta es opcional y no está
verificado; no sirve para autenticar una cuenta.

El destinatario lo fija el servidor mediante `FEEDBACK_TO` en el archivo privado
`.env.local`. Nunca lo decide el cliente. Usa el servicio SMTP ya configurado;
los mensajes son texto plano y no tienen adjuntos. No se envían correos de prueba
reales como parte de las pruebas automatizadas.

## Desarrollo local

El servidor vive en la rama `pro`. `scripts/start-local-cloud.ps1` aplica la
migración idempotente `server/db/07-feedback.sql` sin borrar los datos existentes.
Ambas vistas Vite usan `/api/feedback`; el proxy de Basic expone solo estas rutas
de sugerencias, sin incorporar cuenta o respaldo Pro.

Si falta `FEEDBACK_TO`, el servidor rechaza el envío. El formulario solo confirma
el éxito tras la respuesta del servidor. Los fallos conservan el texto mientras
la ventana permanezca abierta y requieren una nueva comprobación para reintentar.

## Android y publicación

Configurar al compilar `VITE_FEEDBACK_API_URL=https://api.example.com/api`, o usar
la base HTTPS de `VITE_API_URL`. Son direcciones públicas, no claves. Sin una base
HTTPS configurada, el APK muestra que el envío aún no está disponible. Nunca
intenta usar el localhost del teléfono ni una conexión HTTP. Cambiar el dominio
requiere recompilar también la política de contenido.

El servidor actual sigue limitado al desarrollo local. Antes de exponerlo deben
prepararse HTTPS, orígenes autorizados y límites en el proxy de entrada; las
direcciones de proxy solo deben confiarse cuando procedan del proxy controlado.
No se interpreta `X-Forwarded-For` suministrado por el cliente como una IP fiable.

## Controles y límites

- Desafío firmado, ligado a IP, de un solo uso, válido por diez minutos y con una
  espera mínima de dos segundos. La respuesta se valida en el servidor.
- Campo trampa oculto, lista explícita de campos, tipos y longitudes válidos;
  cuerpo de petición limitado a 12.000 bytes.
- Límites de peticiones y de correo: cinco envíos por hora e IP y treinta por
  hora globales. Máximo dos envíos SMTP de sugerencias simultáneos.
- Duplicados normalizados bloqueados durante 24 horas. El envío SMTP ambiguo
  conserva la reserva para evitar repetir un correo que el proveedor pudo aceptar.
- PostgreSQL guarda únicamente hashes y expiraciones para estos controles, no
  el contenido de las sugerencias ni el correo de respuesta. El mensaje sí queda
  en el buzón de destino. Se limpian las entradas vencidas cada minuto.

La suma sencilla ayuda frente a envíos automáticos básicos; no detiene por sí
sola a bots avanzados. Los límites del servidor siguen aplicándose aunque se
modifique la app. En una publicación con tráfico real se debe observar el abuso
y ajustar estos límites o añadir un servicio de comprobación adicional.

Referencias: [validación de entradas de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
y [prevención de denegación de servicio de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html).

## Contrato HTTP

El cliente no envía cookies ni requiere cuenta. Las escrituras siguen exigiendo
un origen local autorizado y JSON. `GET /api/feedback/challenge` devuelve:

```json
{"id":"UUID","token":"nonce.firma","question":"3 + 5 = ?","expiresAt":"fecha ISO","minWaitMs":2000}
```

`POST /api/feedback` acepta únicamente estos campos:

```json
{"challengeId":"UUID","challengeToken":"nonce.firma","answer":"8","message":"Una sugerencia de al menos veinte caracteres.","email":"opcional@example.test","website":"","edition":"basic","appVersion":"0.8.6"}
```

`edition` puede ser `basic` o `pro`; correo, edición y versión son datos declarados,
no una identidad verificada. El éxito responde `200 {"ok":true}`. El campo trampa
responde discretamente `202 {"ok":true}` sin enviar mensajes.

Los errores conservan la forma `{ "error": { "code": "…", "message": "…" } }`:

| HTTP | Código | Significado |
|---|---|---|
| 400 | `invalid_input` | Campos, tipos, tamaños o contenido no admitidos |
| 400 | `feedback_answer` | Respuesta incorrecta; solicitar otra pregunta |
| 400 | `feedback_too_fast` | No transcurrieron dos segundos; solicitar otra pregunta |
| 409 | `feedback_challenge` | Pregunta vencida, usada o no vinculada a esta petición |
| 409 | `feedback_duplicate` | Texto equivalente recibido en las últimas 24 horas |
| 429 | `rate_limited` | Se alcanzó un límite de peticiones o envíos |
| 503 | `feedback_unavailable` | Configuración ausente, dos envíos en curso o entrega no confirmada |

Un intento con estructura válida consume la pregunta antes de comprobar respuesta,
tiempo mínimo o correo. Una firma/IP inválida no puede consumir una pregunta ajena.
Los límites adicionales son diez preguntas por IP cada quince minutos, 120 preguntas
globales por hora y quince intentos POST por IP cada quince minutos. No se confía en
`X-Forwarded-For`; en la vista local los dos proxies pueden compartir el mismo cupo.

## Pruebas sin correo real

Desde `server/`, `npm test` ejecuta las pruebas unitarias. La integración opcional
requiere que los contenedores locales de API y PostgreSQL estén activos:

```powershell
$env:RUN_FEEDBACK_DB_TESTS='1'
npm test
Remove-Item Env:RUN_FEEDBACK_DB_TESTS
```

La integración crea una base desechable con nombre aleatorio, aplica la migración
07 dos veces y elimina esa base al terminar. No modifica registros del usuario ni
lee archivos privados. Usa las conexiones ya configuradas dentro del contenedor
y un objeto `send()` falso: nunca instancia un transporte SMTP. Verifica consumo
concurrente, deduplicación atómica, caducidad, IP, firmas, respuestas, cuotas,
retención y el máximo de dos envíos simulados. Los contenedores predeterminados son
`weight-exercise-local-db-1` y `weight-exercise-local-api-1`; se pueden indicar otros
con `FEEDBACK_TEST_DB_CONTAINER` y `FEEDBACK_TEST_API_CONTAINER`.
