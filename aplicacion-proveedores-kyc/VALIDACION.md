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

**Ingreso remoto confirmado:** el usuario ingresó con su cuenta existente y completó MFA. Chrome mostró su nombre y el directorio con las listas vacías cargadas, sin errores. Se confirma inicio de sesión, segundo factor y consulta remota; crear/editar registros remotos queda por probar. Evidencia: test-results/acceso-glf-confirmado.png.

## Línea gráfica igualada con Salvaguardas — 25/10/2026

- Commit 71a4087f96e3ad896c1ec0790dc36fc5c89c8f10: Vercel success y nueva UI comprobada en producción con la cuenta autenticada.
- Comparación DOM de estilos efectivos con glf-postulaciones.vercel.app/internal: mismos colores, fuente Arial/Helvetica, tamaño, peso, interlineado, padding y radios en cuerpo, cabecera, título, ES/EN, Cerrar sesión y contenedor principal. Altura de cabecera difiere 0,14 px por render de la imagen; no se afirma identidad de captura completa entre módulos distintos.
- Correo validado de la sesión visible bajo el logo; nombre visible sobre el contenido. Identidad accesible con teclado y ayuda de nombre/correo.
- ES/EN y navegación al formulario revisados localmente; vista móvil publicada verificada con correo y cierre visibles, ancho 375 px y scrollWidth 375 px. No se cerró la sesión del usuario para comprobar estilos.
- Hash del logo coincide exactamente con el archivo de Salvaguardas. Estados hover/active/focus y movimiento reducido se derivan de sus estilos. Compilaciones demo y Supabase correctas.
- Evidencia: test-results/linea-grafica-glf-publicada.png.

## 2026-10-25 · Confirmación de estado del proveedor
- Desactivar/Reactivar proveedor sustituye la etiqueta de ficha, en español e inglés.
- Motivo obligatorio seguido de revisión de consecuencias; solo la confirmación final modifica el estado.
- Comprobación en Chrome local: cancelar mantiene activo, editar conserva motivo, desactivar/reactivar registra historial; textos en ambos idiomas revisados.
- Commit: 034826498944e82efa9b56015caf895210cd1a0b.


## 2026-10-25 · Exportación Excel del directorio
- Botón Descargar Excel / Download Excel; respeta los filtros y exporta todas las páginas.
- Archivo XLSX con tabla filtrable, encabezados fijos, fecha Galápagos y criterios de búsqueda; identificaciones y teléfonos como texto.
- Solo columnas comerciales explícitas: no UUID ni información KYC. Sin cambios de permisos.
- 8 pruebas aprobadas; npm audit sin vulnerabilidades tras actualizar UUID indirecto.
- Chrome local: descargas reales reabiertas y verificadas: inglés 4 proveedores y español filtrado por Guayaquil 1 proveedor; búsqueda vacía muestra aviso.
- Commit 789c2e085ed565136ae5796aab16b84dbf0c5869.

- Publicación verificada: descarga desde Vercel reabierta con 20 proveedores, 22 columnas y tabla filtrable.

## 2026-10-25 · Descarga con confirmación y fotos privadas
- Modal único Descargar: cantidad, criterios de búsqueda, Excel o PDF, confirmación explícita. Captura consistente de filtros y resultados al abrir el modal.
- PDF probado con una selección y con los 20 proveedores; 3 páginas renderizadas e inspeccionadas sin recortes.
- Imágenes: creación y edición comprobadas en Chrome local, compresión 1400x900 a 512x329, 3 KB; persistencia después de recargar e historial.
- Migración 202610250003_supplier_images.sql aplicada en Supabase; bucket privado glf-supplier-images, límite 204800 bytes, solo WebP y permisos por proveedor.
- 9 pruebas de aplicación/exportación y 18 de base/identidad/imágenes aprobadas.
- Commit 2d5711c91316b232dac3ab7d1322f80c562cc7bb.

- Verificación publicada: PDF con filtro aire acondicionado contiene exactamente Clima Azul Insular y Técnico Isla Brisa, sin proveedores ajenos al filtro; incluye criterios. Imagen sintética guardada en FICTICIO 01, visible tras recargar (512x329) y registrada en historial. Evidencia: test-results/descarga-excel-pdf-filtros-publicada.png e imagen-proveedor-publicada.png.

## 2026-10-25 · Imagen integrada en identificación
- Imagen o marcador en esquina superior derecha de la tarjeta de identificación, también en registro y edición. Sin tarjeta independiente ni indicaciones técnicas fuera del modal.
- Chrome local: clic abre carga, edición conserva control integrado; perfil de consulta muestra marcador sin botón; vista 390 px sin desbordamiento horizontal. Compilación correcta.
- Commit c45c03b059ca3407cf2d53bab02cbef938020d56.
- Publicación Vercel confirmada. FICTICIO 01 mantiene imagen dentro de identificación; clic Cambiar imagen abre selector y muestra formatos solo en modal. Captura: test-results/imagen-integrada-publicada.png.

## 2026-10-25 · Corrección de distribución según capturas
- Imagen trasladada a la tarjeta superior del nombre y acciones, tanto en consulta como en edición y registro. Identificación recupera el ancho completo.
- Historial debajo de contacto comercial, en la columna derecha. Móvil: encabezado con imagen, acciones debajo y contenido en una columna.
- Compilación y revisión Chrome escritorio/390 px correctas; apertura de imagen y edición verificadas. Commit 284fbf38375b3f297fa55876b510e4003ef13086.
- Vercel verificado: imagen en encabezado superior, historial dentro de columna derecha y ninguna imagen en Identificación. Captura: test-results/ficha-distribucion-mejorada.png.

## 2026-10-25 · Lista de ciudades e islas
- Filtro Ciudad o isla convertido a selector con ubicaciones registradas, orden alfabético, normalización de variantes y Todas las ubicaciones / All locations. Filtrado automático por coincidencia completa.
- 10 pruebas aprobadas (incluye coincidencia exacta y exportaciones); compilación correcta. Commit 32ab0e66eab6bcb87608dd1377b5c91c0992760b.

## 2026-10-25 · Especialidades e identificación comercial
- Botón Agregar especialidad en directorio y editor; modal de creación/reutilización y selección inmediata sin perder especialidades anteriores.
- Ámbito Ambos, documento con país emisor y detección temprana de duplicados, provincias/cantones y correos comerciales adicionales. Exportación incorpora país emisor y correos adicionales.
- 10 pruebas de aplicación/exportación y 20 de base/identidad/imágenes aprobadas. Compilación de demo correcta. Chrome local: duplicado antes del nombre, abrir ficha existente, conservar actividades, guardar Ambos y correo de facturación, nueva especialidad seleccionada y botón Guardar habilitado, pasaporte con país extranjero.
- Migración 202610250004_supplier_details.sql aplicada en Supabase: Success. No rows returned.
- Commit d67515d04bb4deded5f97bcdce2d532770f1c20c; publicación pendiente de verificación final.
- Vercel confirmó Deployment has completed. Chrome publicado: nueva especialidad DEMO · Mantenimiento especializado creada; FICTICIO 02 guardó esa actividad conservando las dos anteriores, ámbito Ambos y facturacion02@example.test. Recarga confirmó persistencia y volvió a abrir el modal de especialidades. Captura: test-results/agregar-especialidad-publicado.png. Se conservan 20 proveedores ficticios.

## 2026-10-25 · Corrección de correos y buscador
- Límite de tres correos adicionales en interfaz, validación y restricción de base de datos. Migración 005: Success. No rows returned.
- Retirado Agregar especialidad del directorio; conservado en editor. Limpiar filtros usa botón secundario.
- Compilación correcta y dos pruebas de dominio/base aprobadas, con rechazo del cuarto correo. Commit 23e14e031681c79e6a24a0de59f2d5331659b2db.

## 2026-10-25 · Teléfonos adicionales
- Dos teléfonos opcionales además del principal; añadir/quitar, detalle y exportaciones ES/EN.
- Migración 006 aplicada: Success. No rows returned. Restricción y guardado auditado; conserva teléfonos en clientes anteriores que omitan el nuevo campo.
- Compilación y seis pruebas de dominio/base/exportación aprobadas: persistencia, máximo dos adicionales y rechazo de duplicados normalizados.
- Commit 96c2f988205822eb13c23197f1e0ff0c7a12077e.
- Verificación publicada: Vercel completó despliegue; FICTICIO 02 guardó +593 000000001 y +593 000000002, conservando el teléfono principal. Al llegar a dos adicionales el botón queda deshabilitado. Historial registra la modificación.

## 2026-10-25 · Resumen compacto
- Tarjetas superiores retiradas; proveedores activos en verde y especialidades en azul junto a resultados. Sin contador de ubicaciones.
- Compilación correcta. Chrome local: búsqueda cambia resultados de 4 a 1 y mantiene totales 4/7; sin tarjetas. Español/inglés verificados. Vista móvil solicitada 390 px, ancho disponible 375 px y scrollWidth 375 px, sin desbordamiento.
- Commit b9c02e18e278446498626b1b5203d420bd332912.
- Publicación Vercel verificada. Chrome muestra 20 resultados, 20 proveedores activos y 22 especialidades, sin tarjetas superiores. Captura: test-results/resumen-compacto-publicado.png.

## 2026-10-25 · Sin botón Actualizar
- Se elimina únicamente Actualizar del encabezado y su manejador. Compilación correcta. Commit 6a77299c9788d644f8c2892bd9d7695f82a2f703.

## 2026-10-25 · Especialidades frecuentes junto al buscador
- Menú desplegable en cabecera del buscador; eliminada franja entre filtros y resultados. Sin ranking se omite el control.
- Compilación correcta. Chrome local EN: selección filtra a dos resultados y cierra menú; no existe #frequent. Móvil 390 px solicitado, ancho/scrollWidth 375 px, menú dentro de pantalla.
- Commit d83d46710bd81320ecfe1ed7f1cfa0d28347d2c6.
- Vercel publicado y Chrome confirmado: control en la misma fila del título del buscador, abre Agua y saneamiento; sin franja inferior. Captura: test-results/especialidades-junto-buscador.png.

## 2026-10-25 · Auditoría previa a KYC

Alcance: directorio comercial de proveedores; registro, edición, identificación y duplicados, ámbitos, contactos, especialidades, imagen, filtros, historial, baja/reactivación, exportación e identidad/permisos. KYC y sus futuras habilitaciones quedan para la siguiente fase.

### Resultado y correcciones
- 10 pruebas de aplicación/exportación y 20 de base/identidad/imágenes aprobadas; compilación correcta. La prueba de imágenes ejecuta ahora la cadena completa de migraciones 001–007.
- Revisión de dependencias de producción: npm audit --omit=dev sin vulnerabilidades conocidas al momento de la revisión.
- Guardado bloqueado desde antes de consultar duplicados: evita envíos simultáneos y modificaciones del formulario durante la operación. Funciona con botón y Enter.
- Un fallo al recargar después de guardar informa que la ficha ya se guardó, evitando inducir un segundo registro.
- Teléfono principal exige números y caracteres de formato admitidos, máximo 50 caracteres; validación tanto en interfaz como en Supabase (migración 007).
- Errores de formulario identifican los campos a corregir. Procesamiento de imagen bloquea selecciones simultáneas y limpia la vista previa anterior. Singular de resultado corregido en pantalla y exportaciones.

### Verificación funcional
- Chrome local con datos sintéticos: perfiles de consulta y Mabel respetan sus acciones; duplicado detectado antes del nombre; documento extranjero/pasaporte; rechazo de teléfono sin dígitos; límites de tres correos y dos teléfonos adicionales.
- Creación, modificación, desactivación con advertencia y motivo, filtrado de inactivos, reactivación e historial probados. Texto de prueba con etiquetas HTML se muestra literalmente, sin inyectar elementos.
- Imagen sintética subida, reducida a 512 × 329 y aproximadamente 3 KB. Guardado y consulta correctos.
- Excel y PDF descargados desde la interfaz con filtro de un solo proveedor. Excel reabierto: 25 columnas, identificadores como texto, todos los contactos y criterios de filtro; sin UUID técnico. PDF extraído y renderizado: una página legible con logo, contactos, filtro y pie. Evidencia local: test-results/auditoria-exportacion-filtrada.png.
- Supabase publicado: siete tablas glf_* con RLS; cero permisos anónimos de tablas/RPC y cero permisos de escritura directa para authenticated. Imágenes privadas, límite 204800 bytes. Se conservan 20 proveedores; los registros nuevos de la auditoría se crearon solamente en la demo local.

### Límites de esta auditoría
No constituye una certificación de seguridad ni una prueba de carga o penetración. Los roles se comprobaron mediante perfiles de demostración y pruebas SQL; no se inició sesión como Carolina o Mabel. La identificación valida formato y duplicados, no verifica existencia legal contra SRI. El manejo de fallo de recarga posterior al guardado fue revisado en código, sin inyección de fallos de red en el navegador. Invitaciones, anexos, firmas, screening y estados de habilitación KYC no forman parte del módulo actual.
- Cierre publicado: commit f9a16399a53257db9da1919f7e936d1a1ffa6b38, Vercel Deployment has completed. Chrome confirmó paginación 1/2–2/2, búsqueda por nombre a un resultado, rechazo del teléfono inválido y guardado de FICTICIO 02 con sus valores originales (nuevo evento de auditoría, sin cambiar sus contactos). Inglés verificado y retorno a español. Captura: test-results/auditoria-final-publicada.png.
- No se detectaron bloqueos en los flujos del directorio cubiertos por esta revisión. Puede iniciarse la construcción de KYC como siguiente fase; la versión continúa limitada a pruebas con datos ficticios.

## 2026-10-25 · Piloto funcional KYC integrado

### Alcance implementado
- Bandeja KYC y expedientes reservados, independientes de la ficha comercial. Buscar proveedor por identificación/nombre antes de crear; aprovechar los datos existentes. Un registro nuevo con nombre y correo puede comenzar como expediente independiente; después se completa la ficha comercial y se vincula. Equipo y Directorio quedan fuera del directorio.
- Formulario unificado ES/EN por vínculo, persona natural/jurídica y condición nacional/internacional. RUC adicional no convierte a la persona natural en sociedad. Campos condicionales de representante, socios con 10 % o más, cónyuge y PEP. Reglas compartidas y aplicadas también en servidor.
- Enlace privado por siete días, renovable, con autoguardado y control de modificaciones simultáneas. Retoma el primer paso incompleto. Renovar invalida el enlace anterior; enviar revoca la edición y registra acuse con fecha y hora de Galápagos.
- PDF con identidad del expediente, versión, logotipo y espacios para las dos firmas externas. Anexos por ruta; firma física escaneada solo por excepción habilitada. Envío exige el PDF actual y documentos requeridos. Conserva versiones y copia de recepción.
- Revisión humana, subsanación, informe/evidencias y formulario contrafirmado. No se permite marcar conforme sin informe, formulario contrafirmado y confirmación humana. La presencia del archivo no valida criptográficamente su firma.
- Prompt por expediente para Gemini/Antigravity, con estructura de informe y evidencias; no ejecuta consultas ni toma decisiones automáticamente. Respaldo ZIP con documentos, datos, historial y manifiesto SHA-256; no incluye token de invitación. La descarga no sincroniza automáticamente con Drive.
- Acceso KYC explícito, MFA obligatorio, documentos privados y delegación temporal a una cuenta interna existente, con vencimiento y revocación. Proveedores no concede por sí mismo acceso a expedientes.

### Verificación realizada
- 41 pruebas automatizadas aprobadas: 30 del directorio y 11 de KYC (incluyendo subpruebas). Reglas de rutas, aislamiento, MFA, links, concurrencia, anexos, recepción, revisión y delegación. Compilación de demo correcta.
- Chrome local: Equipo GLF con PDF, tres anexos, recepción y ZIP; los campos de compañía/banco no aparecen en esa ruta. Persona jurídica consultora internacional con representante, socio al 10 % y traducción al inglés. Declaración PEP familiar despliega los campos correspondientes.
- PDF de Equipo renderizado y revisado visualmente: dos páginas, logotipo, campos aplicables y espacios de firmas. No se ha probado una firma digital real del GLF.
- Supabase/Vercel: caso sintético KYC-00001 vinculado a proveedor ya existente, datos precargados, PDF, cuatro anexos, continuación en segunda pestaña y envío. Recibido el 25 de octubre de 2026 a las 20:37, Galápagos. El enlace anterior deja de permitir acceso después del envío.
- Se incorporó un quinto PDF ficticio como informe para probar la carga interna. Expediente dejado En revisión, con nota expresa de prueba sin validez ni firmas. Los 20 proveedores sintéticos se mantienen.
- Respaldo publicado descargado y reabierto: cinco documentos, hashes coincidentes, ZIP sin corrupción, sin token en expediente.json. Se corrigió la política de lectura de Storage para referenciar storage.objects.name; la prueba SQL verifica que Cumplimiento descarga y usuarios comunes/anon no pueden hacerlo.
- Migraciones 008 y 009 aplicadas en Supabase y verificadas con resultado satisfactorio. Primer despliegue KYC: 3e0527eef81e228b41b8b4910bd9bc6748efe4e2. Ajustes finales de navegación, idioma y descarga documentados en la siguiente publicación.

### Límites y pendientes del piloto
Solo datos ficticios. No constituye una certificación de seguridad ni cumplimiento legal. El correo institucional indicado se muestra como contacto: las invitaciones se copian para envío manual; envío automático y aviso por correo aún no están conectados. La bandeja sí muestra la recepción. Pendiente autorizar el servicio de correo institucional, validar campos definitivos con Carolina (incluidos control sin participación y equivalentes extranjeros), probar firma/contrafirma con herramientas reales, y completar endurecimiento de producción (análisis antimalware, límites de abuso, retención y recuperación operativa). No se enviaron mensajes reales ni se realizó screening real. La aprobación conserva responsabilidad humana.

Cierre de publicación: commit 87b87cc77a4ca3a85853cfed2825c323de8eb5d0; Vercel confirmó Deployment has completed. La migración 009 y la descarga del respaldo se verificaron contra Supabase publicado.

## 2026-10-25 · Búsqueda de expedientes por identificación y nombre
- Caja explícita Buscar expediente por cédula, RUC o nombre; botón Buscar y Enter, Limpiar y ayuda para pasaportes/identificación extranjera. Español e inglés.
- La consulta se ejecuta en Supabase sobre todos los expedientes, sin el recorte previo de 200 recientes. Resultados en páginas de 50, total filtrado, orden estable y permisos KYC/MFA preservados. Solo devuelve los campos de listado; no descarga respuestas completas para filtrar.
- Consulta identificación y RUC adicional del expediente y del proveedor vinculado; nombre declarado, nombre de invitación, razón social y nombre comercial. Ignora mayúsculas/tildes; admite palabras de nombre en distinto orden y separadores en identificaciones.
- Resultados con tipo, país y número de identificación; los expedientes mínimos muestran Identificación pendiente. Sin coincidencias se orienta a revisar identificación o buscar por nombre, sin crear registros.
- 12 pruebas KYC aprobadas, incluyendo búsqueda de expediente antiguo entre más de 200, paginación sin duplicados, RUC vinculado, pasaporte, nombres sin tildes, cero coincidencias y rechazo por falta de permisos/MFA. Demo y servidor coinciden. Compilación correcta.
- Chrome local: cédula, nombre sin tildes y orden cambiado, Enter, cero coincidencias, Limpiar e inglés verificados. Migración 010 aplicada en Supabase.
