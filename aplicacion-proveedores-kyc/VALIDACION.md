# Validación de la primera etapa — 25/10/2026

## Verificado

- Supabase: el panel del nuevo proyecto `glf-operaciones-kyc-archivo` mostró Healthy. Esto verifica la creación, no la instalación del esquema de aplicación.
- `npm test`: 5 casos aprobados, identificación natural/jurídica/extranjera, RUC adicional, duplicados, búsqueda y permisos.
- `npm run test:database`: 9 escenarios aprobados dentro de la prueba de integración PostgreSQL/PGlite. Se ejecutó el SQL real de la migración, incluyendo RLS, funciones y validaciones. Se comprobaron restricciones de consulta y escritura, perfiles inactivos y sin asignación, ámbitos, duplicados, versiones concurrentes, auditoría, desactivación y conteo de visitas.
- `npm run build:demo`: compilación correcta.
- Chrome, demostración local: campos obligatorios; alta de persona natural con cédula/RUC y tres especialidades; creación directa de especialidad; edición como Mabel; historial con autor; persistencia tras recarga; perfil de consulta sin alta/edición; búsqueda por «refrigeracion» sin tilde; desactivación por Dani con motivo, conservación de ficha/historial y exclusión de la búsqueda de activos.
- Cambio ES/EN de la interfaz. Los nombres y descripciones que registra el usuario se conservan en su idioma original.
- Diseño de escritorio revisado con logo visible. Directorio móvil revisado a 390 px de viewport solicitado: documento de 375 px disponibles sin desbordamiento horizontal.

## Pendiente de verificación externa

- Aplicar la migración al proyecto real de Supabase y comprobarla allí. No se afirma que las tablas estén creadas remotamente.
- Crear/asignar la cuenta de prueba y probar inicio de sesión, escritura y lectura reales entre dispositivos.
- Publicación y conexión de GitHub/Vercel; no basta una compilación local para confirmar el despliegue.
- KYC unificado conectado, invitaciones, PDF/anexos/firma, correo, administración de usuarios y delegación temporal: etapas posteriores.
- SSO con el futuro Portal GLF y Salvaguardas: aún sin configurar.

La demostración usa localStorage y perfiles simulados, no constituye un control de acceso real ni un expediente institucional.
