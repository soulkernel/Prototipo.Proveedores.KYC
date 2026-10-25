# Validación de la primera etapa — 25/10/2026

## Verificado

- Supabase: proyecto Healthy; tras la ejecución por el usuario se comprobó «Success. No rows returned» y las siete tablas del directorio en el panel. Evidencia local: `test-results/supabase-migracion-correcta.png`.
- `npm test`: 5 casos aprobados, identificación natural/jurídica/extranjera, RUC adicional, duplicados, búsqueda y permisos.
- `npm run test:database`: 9 escenarios aprobados dentro de la prueba de integración PostgreSQL/PGlite. Se ejecutó el SQL real de la migración, incluyendo RLS, funciones y validaciones. Se comprobaron restricciones de consulta y escritura, perfiles inactivos y sin asignación, ámbitos, duplicados, versiones concurrentes, auditoría, desactivación y conteo de visitas.
- `npm run build:demo`: compilación correcta.
- Chrome, demostración local: campos obligatorios; alta de persona natural con cédula/RUC y tres especialidades; creación directa de especialidad; edición como Mabel; historial con autor; persistencia tras recarga; perfil de consulta sin alta/edición; búsqueda por «refrigeracion» sin tilde; desactivación por Dani con motivo, conservación de ficha/historial y exclusión de la búsqueda de activos.
- Cambio ES/EN de la interfaz. Los nombres y descripciones que registra el usuario se conservan en su idioma original.
- Diseño de escritorio revisado con logo visible. Directorio móvil revisado a 390 px de viewport solicitado: documento de 375 px disponibles sin desbordamiento horizontal.

## Pendiente de verificación externa

- Integrar la identidad existente de Salvaguardas y asignar permisos de prueba; no crear otra cuenta de contraseña. Probar inicio de sesión, escritura y lectura reales entre dispositivos.
- Publicación inicial verificada: https://glf-operaciones-kyc-archivo.vercel.app/ muestra login ES/EN y logo GLF. Evidencia local: `test-results/vercel-login-publicado.png`. PR #1 integrado y configuración de compilación en raíz, commit `dfbc905e10bf6db244994617d5be9776a56637d7`. Esto no valida todavía operaciones autenticadas.
- KYC unificado conectado, invitaciones, PDF/anexos/firma, correo, administración de usuarios y delegación temporal: etapas posteriores.
- SSO con Salvaguardas: aún sin configurar; el usuario lo requiere para probar con su cuenta existente, antes del futuro portal visual.

La demostración usa localStorage y perfiles simulados, no constituye un control de acceso real ni un expediente institucional.

## Mostrar u ocultar contraseña — 25/10/2026

Botón de ojo disponible antes del ingreso, con etiquetas ES/EN, asociación al campo y foco visible. Compilación Supabase correcta; prueba manual en Chrome con texto ficticio: tipo password/text, etiquetas actualizadas y texto conservado. No se envió el formulario ni se utilizaron credenciales reales. Commit: 2f73d55e5e926759d9472cb3be9ee949f19b6092. La integración de identidad única sigue pendiente.
Publicación confirmada: estado Vercel success para ese commit y botón Mostrar/Ocultar contraseña presente y operativo en la URL pública. Evidencia: test-results/vercel-ojo-contrasena.png. Campo de prueba vaciado al finalizar.

## Identidad GLF existente — 25/10/2026

- Usuario confirmó su cuenta interna y autorizó la activación de la confianza OIDC y sus permisos de prueba.
- Migración 002 aplicada: Supabase devolvió el perfil activo con segundo factor requerido. Panel de Third-Party Auth: Custom OIDC ENABLED para el emisor de Salvaguardas.
- Commit 7383838f8aea2c6af3752e647fbf2179e7e10f65 publicado con estado Vercel success. La URL pública muestra «Use el mismo correo y contraseña de su cuenta interna de Salvaguardas GLF».
- Compilación y 22 pruebas aprobadas (5 dominio; 17 incluyendo suites de base e identidad). No se usaron credenciales reales en pruebas automatizadas.
- Pendiente: que el usuario complete el inicio de sesión con contraseña y autenticador para validar las operaciones remotas. La sesión compartida entre enlaces sigue pendiente; esta entrega reutiliza la cuenta, no la cookie de otro dominio.
