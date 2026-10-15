# Pro: estado y prioridades después de v0.5

Pro v0.5 amplía la experiencia local y el prototipo de servidor. Basic conserva las funciones de v0.4 en su rama independiente. Todavía no hay compras ni publicación en Google Play; las dos ramas y los APK con identidades distintas permiten comparar las ediciones, sin obligar a publicar dos fichas.

## Disponible para revisar

- Basic: historial completo y editable, Dark/Light, gráficos, IMC, logros, motivación personalizable y recordatorio diario.
- Pro: cuatro temas (Dark, Light, Aurora y Sand), colores personalizados y gráfico alternable entre área, línea, barras y perspectiva 3D, con desplazamiento y zoom.
- Comparación de registros seleccionados; uno se compara con el punto de partida y varios con el primero cronológico. Excel por mes, filtros o historial completo.
- PDF con visión global y comparación del período elegido con el anterior de igual duración; hábitos, cobertura de datos y pasos disponibles. Fuentes y colores del tema incluidos localmente.
- Cuenta por código de correo, cambio de correo y respaldo/restauración manuales en el PC. El código por correo es acceso sin contraseña de un factor, no 2FA.
- Resumen semanal o mensual por correo, desactivado inicialmente y con consentimiento explícito. Adjunta todos los registros del último respaldo manual, incluidas notas y pasos. La programación persiste en PostgreSQL; necesita el servidor encendido.
- Pasos de Health Connect en Android 14+: lectura de los últimos 30 días con pesajes existentes, al abrir y usar la app. No crea registros de peso ni instala un servicio permanente de seguimiento. Validación en teléfono físico pendiente.

SMTP admite Mailpit de pruebas y correo real con TLS. La conexión y autenticación de Gmail se verificaron **sin enviar un mensaje real**. La entrega, los enlaces de baja fuera del PC y el comportamiento del proveedor aún requieren pruebas. No se ha desplegado nada en AWS; cuenta, respaldo y correo siguen deshabilitados en Android hasta configurar y validar HTTPS.

## 1. Cerrar la versión Android para Google Play

| Trabajo pendiente | Resultado verificable |
| --- | --- |
| Probar un teléfono real | Registrar, reiniciar y actualizar sin pérdida de datos; comprobar permisos, recordatorios, compartir PDF/XLSX y accesibilidad. |
| Validar Health Connect | Conceder/revocar permisos, volver desde ajustes, contrastar fuentes y totales, probar medianoche y cambio de fecha; no crear pesajes ni confundir ausencia con cero. |
| Definir el producto comercial | Elegir desbloqueo Pro dentro de una app o fichas separadas; validar precio y costes del servicio. |
| Integrar Google Play Billing si corresponde | Comprar y restaurar en pruebas, verificar compras y distinguir la edición de desarrollo del acceso comprado. |
| Preparar publicación | Firma de distribución, paquete de tienda, ficha y declaraciones de datos/permisos que reflejen las funciones implementadas. |

La propuesta sigue siendo una Basic útil y gratuita y un desbloqueo Pro, sin publicidad. Las funciones locales y el servicio de nube tienen costes diferentes; no conviene prometer mantenimiento indefinido del servidor antes de definir el modelo.

## 2. Servidor de producción con recursos modestos

El margen informado es **1,15 GB de RAM disponible y 54 GB de disco libre**, con otras aplicaciones en el servidor. El prototipo usa PostgreSQL y una API pequeña, sin ORM, Redis ni una plataforma de administración adicional. La compresión del Excel del correo se realiza al generarlo y se procesa un informe a la vez. [Configuración y mediciones locales](LOCAL-CLOUD.md).

1. Medir picos de RAM, latencia y disco con respaldos e informes de tamaños representativos y varias cuentas. Los límites de contenedor no garantizan capacidad bajo carga.
2. Revisar los servicios existentes antes de desplegar; mantener base y usuario propios y PostgreSQL sin exposición pública.
3. Configurar dominio, HTTPS y correo de producción, con secretos fuera del repositorio. Validar entrega y baja con consentimiento, y separar Mailpit del servicio real.
4. Revisar sesiones, aislamiento de cuentas, límites de intentos y cambio de correo. Evaluar passkeys o autenticador si se añade un segundo factor real.
5. Preparar copias cifradas fuera del servidor y probar una restauración. El respaldo de usuario en PostgreSQL y la copia operativa de la base son distintos.
6. Habilitar Android solo después de validar HTTPS, sesiones y actualización de la app en un teléfono.

El respaldo continúa siendo manual: iniciar sesión no sube ni mezcla registros. Los correos utilizan esa copia, no datos recientes que solo existan en el teléfono.

## 3. Siguientes funciones posibles

| Propuesta | Criterio de calidad |
| --- | --- |
| Comparar dos períodos elegidos libremente | Peso promedio, cobertura y proporciones de hábitos; distinguir falta de datos de un cambio real. |
| Tendencia suavizada del peso | Mostrar también mediciones originales y explicar el intervalo del cálculo. |
| Importación guiada de datos | Revisar fechas, unidades y duplicados antes de modificar el historial; conservar una vía para deshacer. |
| Widgets y accesos rápidos Android | Abrir el registro diario o hábitos sin recorrer toda la app. |
| Ampliar Health Connect | Decidir datos y dirección de intercambio antes de pedir permisos adicionales; comprobar duplicados y origen. |

Son propuestas pendientes. La mayoría puede resolverse en el dispositivo sin guardar series precalculadas ni informes en PostgreSQL.

## 4. Sincronización automática, después del respaldo manual

Solo avanzar tras validar el respaldo en producción. Harían falta revisiones por registro, cola sin conexión, tratamiento de borrados, resolución visible de conflictos y pruebas con dos teléfonos. Cerrar sesión o cambiar de cuenta no debe enviar datos locales a otra cuenta. Restaurar una copia que reemplaza el historial no equivale a sincronizar dispositivos.

## Límites del producto

Weight&Exercise ayuda a observar hábitos y registros. Estadísticas y logros deben premiar constancia y cuidado, sin prometer diagnósticos ni una velocidad de pérdida de peso. Los resúmenes deben conservar el signo del cambio y sus fechas. Basic mantiene el acceso y la edición del historial propio; Pro añade análisis, personalización y comodidad.
