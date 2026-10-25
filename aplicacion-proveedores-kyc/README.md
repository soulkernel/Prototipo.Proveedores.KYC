# GLF · Operaciones, KYC y Archivo

Primera etapa: directorio de proveedores ES/EN. Aplicación piloto; usar solo datos ficticios. No procesa todavía expedientes KYC ni sustituye el screening de Cumplimiento.

## Ejecución local

Node 22 o posterior. Ejecutar `npm ci`, `npm run build:demo` y `npm start`. Abrir http://127.0.0.1:8770/.

La demostración guarda datos ficticios exclusivamente en el navegador. El selector Dani/Mabel/Carolina/Mónica/Consulta simula permisos y no autentica a nadie. No habilitar ese modo para datos reales.

## Conexión real de pruebas

1. Aplicar **una sola vez**, en un proyecto nuevo, `supabase/migrations/202610250001_supplier_directory.sql`. Crea tablas y funciones con prefijo `glf_`, reglas RLS y permisos de acceso. No crea usuarios ni carga proveedores ni modifica tablas de otros sistemas. Ejecutar con un administrador autorizado; se aplica en una transacción.
2. Crear la cuenta de prueba desde Authentication, conservando su contraseña fuera del código. Añadir su UUID a `glf_profiles` mediante una operación administrativa. No hay registro público de perfiles ni creación de privilegios desde el navegador.
3. Configurar `GLF_MODE=supabase`, `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en el entorno del proceso. `.env.example` es referencia; los scripts no cargan `.env` automáticamente. Solo la clave **publishable** o anon puede entrar al build. Nunca usar service_role, clave secreta ni contraseña de PostgreSQL.
4. Ejecutar `npm run build` y `npm start`. Sin configuración válida el build falla; no cambia silenciosamente al modo demo.

El primer perfil se provisiona de forma administrativa hasta que exista la pantalla de administración. Ejemplo **para adaptar con el UUID real de una cuenta de prueba**, no ejecutar sin reemplazar:

```sql
insert into public.glf_profiles
  (id, display_name, supplier_create_scopes, supplier_edit_scopes,
   supplier_archive_scopes, manage_specialties)
values
  ('REEMPLAZAR_UUID_DE_AUTH', 'Administrador de prueba',
   array['government','glf'], array['government','glf'],
   array['government','glf'], true);
```

Para una cuenta de consulta usar los tres arrays vacíos y `manage_specialties=false`. El nombre de prueba no debe usarse para atribuir firmas o actuaciones reales a Carolina u otra persona.

## Publicación en Vercel

- Repositorio: `soulkernel/Prototipo.Proveedores.KYC`.
- Carpeta raíz de Vercel: `aplicacion-proveedores-kyc`.
- Framework: Other; instalación: `npm ci`; build: `npm run build`; salida: `dist`.
- Variables: las tres indicadas arriba. Nombre del proyecto: `glf-operaciones-kyc-archivo`.
- Para una demostración independiente, configurar explícitamente `GLF_MODE=demo`; no comparte información con Supabase.
- No publicar la carpeta padre KYC: contiene formularios y documentación fuente que no forman parte del código.

## Comportamiento

- Cuentas internas activas: consulta del directorio completo, incluidos proveedores de otros ámbitos.
- Creación/edición/desactivación: independientes por ámbito `government` o `glf`. Mabel crea/edita en gobierno y añade especialidades; Dani además desactiva. Carolina administra proveedores de operación GLF; Mónica puede administrar ambos ámbitos.
- Escrituras atómicas por funciones PostgreSQL que comprueban identidad, permiso y versión; sin escrituras directas desde el cliente.
- Identificaciones únicas entre ámbitos. El RUC adicional de una persona natural se contrasta también con el RUC principal de entidades para evitar duplicados.
- La validación de cédula/RUC comprueba longitud y formato; **no certifica existencia, titularidad ni validez ante SRI**.
- Desactivar conserva ficha e historial y requiere motivo. La búsqueda habitual muestra activos.
- Cada visita cuenta como máximo una vez por persona y día de Galápagos para ordenar resultados y especialidades frecuentes.
- Las fichas comerciales no contienen anexos, datos bancarios ni hallazgos KYC. Registrar un proveedor no lo aprueba.
- Cada proveedor conserva un ID estable para futuras relaciones con KYC, compras, contratos y entregas.

## Verificación

`npm test`: identificación, búsqueda y permisos.
`npm run test:database`: aplica la migración en PostgreSQL local mediante PGlite y prueba RLS, cuentas desactivadas/sin perfil, restricciones por ámbito, duplicados, concurrencia, autoría, desactivación y contadores.

La verificación local no confirma instalación en el proyecto remoto. `VALIDACION.md` distingue pruebas y pasos externos pendientes.

## Siguientes etapas

KYC unificado, enlaces temporales, anexos privados, PDF y firmas, screening y exportación; administración de usuarios y delegación temporal de Carolina; compras, contratos, recepción, entregas y archivo. Estos elementos están en el contexto y **no se presentan como funciones terminadas**.

Portal GLF y el inicio de sesión institucional compartido con Salvaguardas requieren integración adicional. La autenticación inicial por correo/contraseña no es todavía SSO ni concede permisos en otra aplicación.
