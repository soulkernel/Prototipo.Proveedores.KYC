# Carga inicial — 28 de octubre de 2026

## Diagnóstico

La entrada descargaba 842.622 bytes de JavaScript (unos 244 KB transferidos con compresión), incluyendo KYC, administración de usuarios y contenido del manual. Los recursos del sitio tenían `Cache-Control: no-store`, por lo que las visitas posteriores no podían aprovechar la caché de los archivos de aplicación.

Tres mediciones públicas sin sesión, desde este equipo: pantalla de ingreso disponible en 1.407, 1.010 y 829 ms. Son muestras de esta conexión, no un tiempo garantizado ni una medición de las consultas de una sesión autenticada.

## Cambio

- KYC, Usuarios y Manual interno se cargan al abrirlos. Los permisos y las comprobaciones de cambios sin guardar se mantienen.
- Un build ESM con división de código comparte dependencias entre módulos y conserva las descargas bajo demanda.
- JavaScript y CSS usan nombres con hash de contenido en `/assets/`; cada cambio genera nuevas URLs. Esos archivos públicos reciben caché inmutable por un año.
- HTML, expedientes y demás rutas no reciben esa excepción. Se conservan las reglas existentes de autenticación, MFA, CSP y acceso a datos.
- Las dependencias estáticas del inicio se precargan en paralelo mediante `modulepreload`, sin anticipar los módulos opcionales.
- La metadata del build se guarda en `tmp/build-meta.json`, fuera de la salida pública.

## Validación local

JavaScript inicial: 421.614 bytes en el build de demostración, aproximadamente 50 % menos que la entrada anterior. `scripts/qa-loading.mjs` comprueba presupuesto de 500 KB, exclusión de módulos opcionales del arranque, apertura de cada módulo, perfil de consulta, aviso de cambios pendientes, ruta externa y caché en segunda visita (nueve recursos reutilizados).

22 pruebas de dominio, importación/exportación, PDF, manuales y campos aprobadas. Además se verificaron las ocho descargas de manuales ES/EN, Excel/PDF de proveedores y generación del PDF KYC desde un formulario sintético. Sin errores JavaScript en esas pruebas. No se cambiaron datos ni políticas de Supabase.

Para reproducir: `npm run build:demo`, iniciar `scripts/serve.mjs` con `PORT=8778`, ejecutar `node scripts/qa-loading.mjs`. Comprobar además el build autenticado y los encabezados del despliegue real. Los tiempos dependen de red, dispositivo y estado de sesión; no confundir reducción de bytes con el mismo porcentaje de reducción de tiempo.

Referencias técnicas: [división de código de esbuild](https://esbuild.github.io/api/#splitting) y [encabezados de caché en Vercel](https://vercel.com/docs/caching/cache-control-headers).
