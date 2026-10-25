# Corrección de acceso — 25/10/2026

El login inicial consultaba el Auth de Operaciones, que estaba vacío. La cuenta interna del usuario ya existe en el proyecto GLF Postulaciones/Salvaguardas. No se crea ni sincroniza otra contraseña.

## Implementación preparada

- El cliente de identidad usa `dcxhuwghakdjcnrqkziq`; el cliente de datos conserva `owiaybnhvvuotttruopl`. Solo se incluyen claves publicables.
- En el proyecto de datos, Custom OIDC debe confiar en el emisor `https://dcxhuwghakdjcnrqkziq.supabase.co/auth/v1`. Sus metadatos de descubrimiento y clave pública ES256 se comprobaron por HTTPS.
- Migración 002: los perfiles de permisos se vinculan al UUID y emisor de la cuenta existente. No hay filas duplicadas en `auth.users`. Se conserva RLS, se comprueban emisor, audiencia, rol, perfil activo y segundo factor. Los tokens de clientes OAuth no autorizados se rechazan.
- El usuario eligió su cuenta interna. La asignación concreta está en un SQL local excluido de GitHub bajo `test-results/`, para no publicar datos de la cuenta. Permite probar el directorio de ambos ámbitos y sus especialidades; no concede acceso a expedientes KYC.
- El inicio de sesión y la recuperación de sesión comprueban `access_session_valid` en el origen. Los permisos locales y MFA se comprueban además en la base de datos destino. El segundo factor se valida en el mismo servicio GLF mediante el autenticador existente.
- Los errores de conexión y falta de perfil no se presentan como contraseña incorrecta.

## Límites y siguiente etapa

Se conserva una única identidad, pero todavía hay sesiones separadas por dominio. El cierre aquí revoca la sesión local de esta aplicación. Un portal/redirección OIDC para reutilizar la sesión del otro dominio sigue pendiente; no se copian cookies ni se transportan tokens por URL.

La desactivación de permisos locales bloquea inmediatamente las operaciones. La revocación central se comprueba al ingresar/restaurar la sesión, y los tokens ya emitidos pueden seguir siendo aceptados por la API de datos hasta su expiración si se llama directamente. Antes de uso real se deberá completar el ciclo central de revocación y desactivación de todas las aplicaciones. Este despliegue sigue siendo piloto con datos ficticios.

## Validación

Compilación correcta. Diecisiete pruebas de autenticación y PostgreSQL aprobadas, además de cinco pruebas de dominio: rutas separadas, ausencia de cuenta Auth duplicada, identidad no asignada, emisor/audiencia/rol/cliente incorrectos, MFA y prevención de autoasignación de privilegios. La UI local muestra la instrucción de usar la cuenta existente y conserva el ojo.

Con autorización expresa del usuario se aplicaron la migración y su perfil interno de prueba; Supabase devolvió el perfil activo con MFA requerido. Se activó Custom OIDC y el panel confirmó ENABLED para el emisor GLF indicado. Falta comprobar el ingreso del usuario con su autenticador real; no se solicita su contraseña. No se afirma todavía que se haya completado una operación autenticada en la aplicación pública.

**Resultado posterior:** el usuario confirmó ingreso satisfactorio y doble factor completado. Se verificó el directorio autenticado en Chrome, con su perfil y listas vacías sin errores. No se probaron todavía altas o ediciones remotas. Se mantiene pendiente el SSO de sesión entre dominios.
