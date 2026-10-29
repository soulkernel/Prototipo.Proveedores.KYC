# Manuales de uso — 28 de octubre de 2026

## Alcance

Un manual interno completo, disponible para todos los usuarios internos activos, y un manual independiente del formulario externo. La documentación no amplía permisos. El externo no necesita autenticación ni el token de un expediente para abrirse.

El manual interno tiene 15 capítulos: acceso, directorio, ficha, mantenimiento, importación/exportación, nuevo KYC, invitaciones, asistencia, bandeja, screening, decisión, asociación comercial, respaldo, usuarios/delegación y soporte. El externo tiene 10: acceso, clasificación, identidad, actividad, personas relacionadas, declaraciones, documentos, firma, envío y ayuda.

## Integración

- Menú **Manual interno**, sin segmentación de capítulos por perfil.
- `/manual-externo.html?lang=es` o `?lang=en`, con ayuda por etapa mediante fragmentos `#manual-identidad`, etc.
- Enlace desde formulario externo, formulario asistido y mensaje de invitación. El enlace al manual no transmite el token privado.
- Índice, buscador, capturas ampliables, navegación por teclado y diseño móvil.
- Word editable y PDF completos; el filtro de búsqueda nunca recorta las descargas. Texto e imágenes monocromos en documentos descargados.
- Fuentes editoriales comunes para web y descargas; 34 capturas de la aplicación con datos sintéticos locales. No se exportan expedientes reales.

## Verificación local

- 20 pruebas de directorio, importación, exportación, PDF, invitación y manuales aprobadas. Adicionalmente, 16 pruebas de campos/contactos/invitaciones/manuales aprobadas.
- Playwright: cuatro combinaciones de público/idioma, búsqueda vacía y sin resultados, índice, ampliación/Escape, ocho descargas, imágenes completas, pantalla de 390 px sin desbordamiento y ausencia de errores JavaScript.
- Perfil interno de consulta: 15 capítulos visibles, incluidos screening y usuarios, con accesos operativos no autorizados deshabilitados.
- Externo: 10 capítulos, sin navegación administrativa ni capítulos internos.
- Word abierto y exportado mediante Microsoft Word; PDF y exportaciones de Word renderizados con Poppler y revisados. 16 páginas por manual interno y 11 por externo en ambos idiomas. Comprobación automatizada de imágenes y páginas en escala de grises, sin páginas vacías.

Esta verificación documental no sustituye pruebas de firma electrónica con las herramientas GLF ni la integración de correo pendiente. No se cambiaron cuentas, permisos, RLS, migraciones ni datos de Supabase.

## Mantenimiento

Actualizar `src/manual-internal-data.js` y `src/manual-external-data.js` cuando cambie un recorrido. Regenerar capturas locales con `scripts/capture-manuals.mjs`, compilar y ejecutar `scripts/qa-manuals.mjs`. Los scripts de captura y QA solo aceptan localhost. Revisar también las descargas y su paginación, no únicamente el HTML. El despliegue se confirma por separado en el registro compartido.
