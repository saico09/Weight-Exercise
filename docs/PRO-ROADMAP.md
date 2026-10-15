# Pro: prioridades después de v0.4

La v0.4 sirve para comparar Basic y Pro y probar la cuenta y el respaldo en Docker local. Estas son propuestas de producto y trabajo pendiente; no son funciones ya disponibles ni promesas de publicación.

## Lo que ya se puede revisar

- Basic conserva historial completo y editable, Dark/Light, gráficos, IMC, logros, motivación personalizable y recordatorio diario.
- Pro añade colores, estadísticas semanales, informes PDF y recuentos de progreso.
- En la vista Pro del PC: bienvenida con cuenta, códigos por correo en Mailpit, cambio de correo y respaldo/restauración manuales.
- Las ramas `basic` y `pro` permiten comparar ambas ediciones; los APK de prueba tienen identidades distintas para instalarlos juntos.

## 1. Cerrar la primera versión para Google Play

| Trabajo | Resultado verificable |
| --- | --- |
| Probar Android real | Registrar, reiniciar, actualizar APK sin perder datos; probar permisos, recordatorios y compartir PDF. |
| Definir un producto comercial | Decidir entre una app gratuita con desbloqueo Pro o dos fichas. Las dos ramas actuales no obligan a publicar dos apps. |
| Integrar Google Play Billing si se elige desbloqueo | Comprar y restaurar en el entorno de pruebas, verificar compras y distinguir acceso real de la edición de desarrollo. No simular compras exitosas. |
| Preparar publicación | Firma de distribución, compilación para tienda, materiales y declaraciones que reflejen los datos realmente tratados. |

La opción propuesta sigue siendo Basic útil y gratuita más un desbloqueo Pro, sin publicidad. El precio, la modalidad y las condiciones se deben validar antes de vender. Si más adelante se ofrece un servicio recurrente de nube, conviene separar sus costes del valor de las funciones que trabajan completamente en el teléfono.

## 2. Respaldo de producción con recursos modestos

El servidor dispone de **1,15 GB de RAM disponible y 54 GB de disco libre**, y ya sostiene otras aplicaciones. La prioridad es medir y preservar ese margen, no añadir infraestructura por anticipado.

1. Medir PostgreSQL y la API con cuentas y registros representativos, incluyendo carga de respaldos, restauración y generación simultánea de códigos. Registrar RAM máxima, latencia y crecimiento en disco.
2. Revisar el servidor y sus servicios antes de desplegar. Mantener base y usuario propios, límites conservadores y acceso a PostgreSQL únicamente desde el backend.
3. Configurar dominio y HTTPS, correo real con un proveedor transaccional y secretos fuera del repositorio. Mailpit se mantiene exclusivamente en desarrollo.
4. Verificar aislamiento de cuentas, límites de intentos, expiración de códigos, cambio de correo y revocación de sesiones. El código por correo es un factor; si hace falta un segundo factor, evaluar una llave de acceso o autenticador.
5. Programar copias cifradas fuera del servidor, con retención acotada y una prueba real de restauración. La copia de usuario dentro de PostgreSQL y el respaldo operativo de PostgreSQL resuelven problemas diferentes.
6. Habilitar la cuenta en Android solo después de probar el transporte seguro, las sesiones y el ciclo de actualización de la app.

Por ahora, el respaldo requiere una acción explícita. No hay sincronización automática, mezcla entre historiales ni respaldo a AWS.

## 3. Funciones Pro que aportan valor sin un servidor pesado

| Prioridad | Propuesta | Criterio de calidad |
| --- | --- | --- |
| Alta | Comparar dos períodos elegidos | Mostrar peso promedio, días registrados y proporción de hábitos; distinguir falta de datos de un cambio real. |
| Alta | Tendencia suavizada del peso | Permitir alternar mediciones y tendencia; conservar los valores originales y explicar el período usado. |
| Alta | Exportación CSV e importación guiada | Recuperar y llevarse datos; validar unidades, fechas y duplicados antes de modificar el historial. |
| Media | Informes con períodos comparados | Incluir tablas y gráficos compartibles, manteniendo generación local y selección clara del contenido. |
| Media | Widgets y accesos rápidos Android | Registrar hábitos o abrir el peso diario sin navegar por toda la app. |
| Media | Recapitulaciones con más contexto | Comparar semanas completas y cobertura de datos; ofrecer frecuencia y horario controlados por el usuario. |
| Posterior | Integración con Health Connect | Empezar por peso con permiso específico; detectar duplicados y explicar qué datos se leen o escriben. |

Las primeras mejoras pueden calcularse en el teléfono. No requieren guardar imágenes grandes, series precalculadas ni informes PDF en PostgreSQL. Las fotografías de motivación ya se comprimen localmente; los PDF se generan al solicitarlos.

## 4. Sincronización automática, después del respaldo manual

Solo avanzar cuando el respaldo manual funcione de manera estable en producción. Se necesitarían identificadores y revisiones por registro, cola de cambios sin conexión, tratamiento de borrados, resolución visible de conflictos y pruebas con dos teléfonos. Cerrar sesión o cambiar de cuenta no debe enviar la información local a otra persona por accidente.

La sincronización debe ser opcional y comprensible. Una restauración manual que reemplaza el historial no debe presentarse como sincronización entre dispositivos.

## Límites del producto

Weight&Exercise ayuda a observar hábitos y registros. Las estadísticas y logros deben premiar constancia y cuidado personal, sin prometer diagnósticos, prescripciones ni una velocidad de pérdida de peso. Un cambio de peso no implica por sí solo una mejora o un empeoramiento; los resúmenes deben conservar el signo del cambio y sus fechas.

Mantener gratuitos el acceso a los registros propios, su edición y la motivación básica. Pro puede aportar análisis, personalización y comodidad sin convertir el historial del usuario en una barrera de pago.
