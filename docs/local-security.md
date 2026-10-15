# Seguridad local y política de contenido

Las compilaciones de producción (`npm run build`) incluyen una Content Security
Policy generada por `scripts/security-policy.ts`. Solo permiten scripts propios;
no permiten JavaScript inline ni `eval`, marcos, objetos incrustados o envíos de
formularios. Los estilos inline se conservan porque los usan Ionic, los temas y
los gráficos. Las fotos locales pueden usar `data:` o `blob:`; las fotos remotas
no se admiten. El navegador no envía el encabezado Referer desde la app.

Las conexiones se limitan al mismo origen y a los orígenes HTTPS configurados en
`VITE_API_URL` y `VITE_FEEDBACK_API_URL`. Ambos valores son bases de API públicas,
por ejemplo `https://api.example.com/api`, sin usuario, contraseña, consulta ni
fragmento. No contienen claves. Si se cambia el servidor, hay que recompilar la
app; no se permite una lista abierta de servidores. La CSP limita conexiones,
no sustituye la validación de certificados, los permisos de cada API ni la
autenticación. La vista de desarrollo con Vite conserva el proxy local y su
WebSocket de recarga; esta política se aplica al resultado compilado.

En Android, Capacitor instala el puente nativo antes del meta CSP; la prueba
`ProductionCspTest` verifica ese orden contra la dependencia instalada. Al
actualizar Capacitor debe ejecutarse de nuevo y comprobarse también un arranque
real en Android. Se deshabilitan explícitamente el tráfico HTTP y el contenido
mixto; no se agrega una excepción para instalaciones de producción.

El FileProvider general puede compartir únicamente archivos de `cache/exports`
y, en Pro, `cache/reports`. Nunca comparte la raíz de caché ni el almacenamiento
externo. La migración usa su propio proveedor limitado a `cache/basic-to-pro`,
comprobación de firma entre apps y confirmación de importación. Los respaldos
automáticos de Android y la transferencia automática de dispositivo excluyen
los datos de la app; el respaldo de Pro se solicita desde la propia app.

Pruebas relacionadas: `securityPolicy.test.ts`, `migration.test.ts`,
`profilePhoto.test.ts`, `motivation.test.ts` y las pruebas Android de migración.
Estas medidas reducen superficies concretas; no garantizan seguridad total en
un dispositivo alterado ni reemplazan la revisión del servidor y de nuevas
dependencias.

Referencias: [FileProvider de Android](https://developer.android.com/privacy-and-security/risks/file-providers)
y [seguridad de Capacitor](https://capacitorjs.com/docs/guides/security).
