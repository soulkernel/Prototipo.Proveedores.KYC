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

Publicación verificada: afb02450db9386b997bd66f65aab08f5afc9ffdd, Vercel Deployment has completed. Chrome publicado encontró KYC-00001 por RUC adicional 0000900002001 y por brisa tecnico sin tilde; verificó cero coincidencias y Limpiar. Identificación muestra cédula y RUC. Captura local: test-results/kyc-busqueda-identificacion-publicada.png.

## 2026-10-25 · Inicio de screening y ciclos de revisión

- Nuevo screening consulta primero el directorio completo y los expedientes por cédula, RUC, pasaporte o nombre; permite continuar un proceso abierto o iniciar una evaluación nueva conservando la anterior. La creación se serializa en servidor para evitar duplicados concurrentes. Un KYC vigente exige motivo para revisión anticipada; un resultado no conforme exige justificar otra evaluación y nunca se muestra como habilitación.
- Política institucional revisada: Cumplimiento de las Normas contra el Blanqueo de Capitales, octubre 2024, página 10, sección 6: alto 12 meses, medio 24, bajo 36. No se adoptó un plazo general de seis meses.
- Decisión operativa acordada: cómputo desde la carga del informe definitivo seleccionado, por fecha de Galápagos y meses calendario. Se registran separadamente emisión, carga y decisión. La carga por sí sola no aprueba ni renueva; el cierre favorable requiere informe, riesgo, contrafirma y confirmación humana.
- Fecha manual con motivo, versión para concurrencia y auditoría. Las extensiones sobre la política requieren reconocimiento explícito y quedan señaladas como excepción, sin presentarse como cumplimiento del plazo. Ajustar una fecha no cambia la fecha base ni la fecha original de política. Una evaluación anterior con un ciclo posterior no admite ajustes.
- Nuevo ciclo precarga información para revisión del declarante pero no hereda firma, anexos, PDF ni confirmación de veracidad. Staff y Directorio continúan fuera del directorio comercial. El prompt se ofrece después de recibirse el formulario.
- 43 pruebas automatizadas aprobadas: 13 KYC, 10 dominio/exportación y 20 base de datos/identidad/permisos. Incluyen 12/24/36 meses, año bisiesto, excepciones, concurrencia, conservación del historial y rechazo a usuarios sin acceso KYC/MFA. Compilación correcta.
- Chrome demo: cierre ficticio con informe y contrafirma de prueba; riesgo alto calculó 2027-10-25 desde carga 2026-10-25; ajuste anticipado a 2027-04-25 conservó fecha de política; nueva evaluación conservó la anterior y una consulta posterior ofreció continuar el expediente abierto. Historial legible y versión inglesa comprobados. Ninguna de estas simulaciones constituye screening real o firma válida.
- Publicación y migración 011: pendiente de verificación final en esta sesión.

Verificación publicada del ciclo KYC: commit afedbd7bc681b218f63a80f5071fcacc0235acca, Vercel confirmó Deployment has completed. Migración 011 aplicada en Supabase con Success. No rows returned. Chrome autenticado encontró por RUC 0000900002001 la ficha comercial y KYC-00001; seleccionar proveedor ofreció Continuar proceso. Cálculo visible de riesgo medio: carga 2026-10-25 -> revisión 2028-10-25. No se guardó ninguna decisión en el expediente publicado existente.
Se creó KYC-00002 para FICTICIO 03 · Papel y Oficina Coral desde su ficha: precarga de nombre, correo, RUC, domicilio, actividad y representante confirmada. Repetir búsqueda por 0000900003001 ofreció continuar ese mismo expediente, sin otro registro. Se dejó en Borrador, sin enviar correos ni generar calificación. Los 20 proveedores se conservan. Disponible para continuar la prueba manual del formulario.
## 2026-10-25 · Alineación con el prototipo validado por GLF

- Fuente de referencia: prototipo publicado en GitHub Pages, conservado sin modificaciones. Se incorporan sus rutas y seguimiento a la aplicación funcional respetando las decisiones posteriores del usuario.
- Formulario 2026-10-25.2: vínculo nacional/internacional para proveedores y consultores, Equipo GLF y Directorio. Persona natural ecuatoriana puede escoger cédula o RUC; elegir RUC no activa campos de compañía ni duplica el número tributario. Anexo tributario exigido para proveedores/consultores, conforme al correo de Carolina. Nombramiento y socios corresponden a persona jurídica.
- Ayuda por etapa, resumen de ruta, acceso KYC desde ficha comercial y lista de proveedores, estados con conteos y filtros en servidor antes de paginar. Fechas de enlace y vigencia KYC diferenciadas. No se expone el screening reservado al directorio general.
- Prompt de screening ampliado con Banco Mundial, BID y Contraloría; exige evidencias, alcance de la consulta y pendientes explícitos. La IA no aprueba expedientes.
- Usuarios y accesos: permisos por módulo/ámbito, MFA obligatorio, motivo e historial; invitaciones por correo exacto para una cuenta central GLF existente. No crea otra contraseña ni da de alta automáticamente identidades centrales. La aceptación rechaza MFA débil, cuenta distinta e invitación revocada/vencida. Un administrador no modifica sus propios permisos. Las delegaciones incrementan versión para evitar sobrescribir cambios concurrentes.
- 46 pruebas automatizadas aprobadas: 15 KYC, 21 base de datos/identidad, 10 dominio/exportación. Compilación demo correcta. Pruebas Chrome locales: alta/revocación de invitación ficticia; entrada desde proveedor; persona natural con RUC hasta anexos sin documentos de compañía; versión inglesa; filtro de borradores y conteos.
- Guía local GUIA_ADMIN_GOOGLE_WORKSPACE_CORREO_KYC.html preparada para coordinación en horario de oficina. OAuth Gmail de envío propuesto; servicio de correo, callback y autorización pendientes. El piloto conserva copiar mensaje/enlace y recepción en bandeja. No se enviaron correos reales.
- Migraciones 012–015 y publicación: verificación en curso. La habilitación inicial de administración de usuarios fue autorizada expresamente por el usuario para su cuenta de prueba; no se asignan permisos reales a Carolina/Mónica por inferencia.

Verificación publicada de alineación: commit 57c0ef2b6154ab3eec75ca84a45b4037c103b5ea; Vercel confirmó Deployment has completed. Supabase confirmó migraciones 012–015 y activación autorizada de administración de usuarios con MFA. Chrome mostró Usuarios y accesos, cuenta conectada e historial de activación; la bandeja encontró los dos expedientes y filtró un borrador. Entrada desde FICTICIO 03 ofreció Continuar proceso sobre KYC-00002, sin duplicarlo. Los 20 proveedores se mantienen; ningún expediente fue aprobado ni se enviaron mensajes.
Ajuste final: contraste del filtro seleccionado incluso con hover. Migración 016 aplicada con Success. No rows returned: versión 2026-10-25.2 para nuevos formularios; un borrador anterior adopta la versión nueva al guardarse y requiere regenerar PDF/anexos. No modifica retrospectivamente expedientes recibidos/cerrados. Prueba SQL confirma incremento de versión e invalidación del PDF previo. Se mantienen 46 pruebas aprobadas; compilación correcta.


## 2026-10-26 · Incorporación del demostrativo institucional

Revisión comparada del HTML institucional publicado, aplicación funcional y decisiones posteriores del usuario. Se mantiene intacto el demostrativo de GitHub Pages.

| Elemento del demostrativo | Implementación o adaptación vigente |
| --- | --- |
| Iconos de módulos y acciones | Incorporados conservando colores, tipografía, logotipo embebido y navegación GLF; etiquetas accesibles en español/inglés. |
| Directorio, búsqueda y filtros | Existentes; se conservan conteos en línea y especialidades frecuentes junto al buscador según correcciones posteriores. |
| Alta, contactos, imágenes y duplicados | Existentes; identificación temprana y bloqueo de duplicados en servidor. Se agregan actividades a la ficha existente; no se reincorpora el bypass ilustrativo de duplicados. |
| Especialidades | Alta directa desde el formulario comercial. Se mantiene fuera del motor de búsqueda por instrucción del usuario. |
| Importación CSV/XLSX ilustrativa | Convertida en revisión asistida local: plantilla, 2 MB/100 filas, rechazo de fórmulas XLSX, campos pendientes y especialidades no reconocidas. Cada fila se abre en el editor; solo Guardar registra una ficha usando validaciones/permisos existentes. No se cargó una base real. |
| Exportación comercial | Excel/PDF reales con criterios de los filtros confirmados; no exporta KYC. |
| Nuevo screening y alta rápida | Existentes: buscar primero proveedor/antecedentes, continuar abierto o iniciar ciclo. Expediente mínimo con nombre/correo; ficha comercial posterior. Staff/Directorio fuera del directorio. |
| Bandeja institucional | Código, contraparte con identificación, vínculo/ruta, fecha de invitación, estado, vencimiento del enlace, screening y acciones. Colores, fechas Galápagos, paginación y filtros en servidor. |
| Filtros prioritarios | Todos, Invitación vigente, En revisión, Subsanación, Apto y Cerrado. Más filtros mantiene borradores, recibidos, vencidos, no conformes y vigencia no verificada. Cerrado incluye decisiones finalizadas; no equivale a aprobación. |
| Prompt por fila | Disponible tras recepción; diálogo editable y copiable a Gemini/Antigravity, generado desde ese expediente. Antes de recepción está deshabilitado con explicación. No ejecuta consultas ni aprueba. |
| Resultado de screening | Persistido separadamente: pendiente, posible homónimo, limpio/sin coincidencias relevantes o hallazgo confirmado. Requiere revisión humana, fundamento y evidencia de la versión actual salvo pendiente; registra actor, fecha y versiones. |
| Decisión final | Apto exige screening resuelto de las respuestas actuales, además del informe, contrafirma, riesgo y confirmación existentes. Un cambio de respuestas marca screening para revisar; no se inventan resultados históricos. |
| Formulario externo dinámico | Existente: rutas unificadas, persona natural con cédula/RUC sin convertirse en compañía, socios ≥10%, PEP, ayuda por pasos, guardado, PDF y anexos antes de Enviar. No requiere cuenta interna. |
| Invitación y recepción | Enlace siete días, renovable conservando borrador, invalidado al enviar. Aviso de recepción en pantalla y bandeja. Correo automático sigue pendiente de autorización/configuración Google Workspace. |
| Documentos y respaldo | Versiones privadas, informe/capturas adjuntables y contrafirma; ZIP con datos, archivos e integridad, ahora incluye screening. Se corrige lectura externa para excluir nombres/metadatos de informes internos durante subsanación. |
| Usuarios y permisos | Existentes con identidad central GLF, MFA, permisos por ámbito, historial y delegación temporal. No se replican cuentas ficticias ni selector de rol en producción. |
| Observaciones/ayuda | Guía interna bilingüe de uso y prueba del formulario, adaptada a decisiones vigentes. No se reintroducen preguntas ya resueltas del demostrativo. |

Validación: 50 pruebas aprobadas (13 dominio/importación/exportación/PDF, 21 base de datos/identidad, 16 KYC). Migración 017 ejecutada en Supabase con Success. No rows returned. Pruebas de privacidad verifican exclusión de informes internos en el enlace, rechazo sin MFA/permisos, evidencia de otro expediente/versión, concurrencia, rollback de cierres incompletos y nuevo ciclo sin heredar screening. Compilación demo correcta.

Chrome local: importación de CSV sintético y guardado individual; filtros, ocho columnas, prompt copiado con código correcto, guía e inglés. Diseño a 390 px sin desbordamiento horizontal; las filas se reorganizan con etiquetas. Las decisiones históricas conservan su resultado; no se aprobó ningún expediente publicado. La publicación y su comprobación se registran en el contexto local al finalizar.

Pendientes externos reales: autorización y servicio de correo Google Workspace; comprobación de firmas con herramientas GLF; aceptación por usuarios con datos ficticios antes de habilitar datos reales. El respaldo a Drive es manual mediante ZIP; no se presenta como sincronización automática. Migración masiva de un padrón real y automatización autónoma del screening no forman parte de esta entrega.


### Menú principal uniforme (2026-10-26)

Por instrucción del usuario, todas las cuentas internas ven Proveedores, KYC, Usuarios y Guía en el mismo orden. KYC/Usuarios sin permiso se muestran como botones deshabilitados, con texto explicativo al pasar el puntero. No se conceden permisos ni se descargan expedientes por mostrar el menú. Los controles de autorización y MFA del servidor siguen siendo obligatorios. Las acciones dentro de cada módulo conservan sus permisos específicos.

Verificación publicada del cambio institucional: commit 84d2b31598190fc8b997dc042ff5be5432c1ddbb, Vercel Deployment has completed. La sesión existente conserva MFA/permisos y muestra los 20 proveedores y dos expedientes. Verificados fecha real de invitación, columnas y estados, Prompt de KYC-00001 copiado y panel de resultado con evidencia de la versión actual. ZIP descargado y reabierto: cinco documentos, tamaños/huellas SHA-256 correctos, campos de screening incluidos. No se cambió una calificación ni se envió correo. Menú uniforme probado localmente: Dani/Consulta ven KYC y Usuarios deshabilitados; Carolina tiene KYC habilitado; Mónica tiene ambos habilitados. Se prepara la publicación del ajuste final de menú.


### Inicio KYC y búsqueda sin coincidencias — 2026-10-26

Buscar expedientes consulta expedientes y directorio. Cuando ambos totales son cero, Crear nuevo expediente aparece con estilo principal debajo del buscador y antes de los resultados. El buscador pasa a estilo secundario. Cada resultado vacío reúne título/contador y explicación pequeña en una fila adaptable. Modificar la consulta descarta resultados y acciones anteriores hasta buscar nuevamente.

El alta muestra la búsqueda realizada solo como referencia, sin inferir persona jurídica por tener RUC; enfoca el nombre y conserva los tres campos mínimos. Iniciar KYC y preparar invitación guarda el expediente y lleva al panel de invitación para generar/copiar el enlace; no envía correo. Un proveedor existente ofrece Iniciar KYC con este proveedor y un expediente en curso permite Continuar expediente. Cuando hay coincidencias de otro sujeto, el alta alternativa queda en un desplegable secundario. Las revisiones vigentes y sus motivos mantienen sus controles.

Validación: compilación demo correcta y 16 pruebas KYC aprobadas. Chrome local: cero resultados, cambio de consulta (sin botón/formulario obsoleto), foco en nombre, referencia consultada, creación ficticia y generación de enlace, continuidad del expediente y precarga de proveedor existente. ES/EN comprobados; viewport 390 px sin desbordamiento horizontal. No se crean registros publicados durante estas pruebas ni se cambian permisos/base de datos.



### Invitación independiente y ficha comercial opcional — 2026-10-26

Para una contraparte nueva, Invitación y seguimiento aclara que puede enviarse la invitación con los datos básicos; no exige crear un proveedor. El enlace conserva siete días. La asociación manual queda cerrada bajo “Asociar a un proveedor existente — opcional”. Los expedientes iniciados desde un proveedor muestran su nombre y código vinculados.

Tras recibir el formulario, proveedores y consultores en recepción/revisión o con decisión final pueden preparar una ficha comercial, si la cuenta tiene permiso de creación. Se abre el editor existente con una lista explícita de campos compartidos: identidad, nombre, correo/teléfono, país/ciudad, descripción de servicios y representante cuando corresponde. No se copian dirección domiciliaria, datos bancarios, ingresos, PEP, familiares, socios, anexos ni screening. No se copian respuestas parciales de una subsanación abierta. Deben revisarse los campos comerciales y elegirse especialidades antes de guardar. Staff y Directorio quedan excluidos.

La identificación se comprueba antes de guardar. Si existe, se puede asociar explícitamente esa ficha sin duplicarla. Al guardar una ficha nueva se asocia al expediente y se vuelve a KYC. Si la asociación falla después del guardado, el aviso indica que la ficha ya existe y permite reintentar mediante asociación, evitando otra alta. Crear/asociar una ficha no modifica las respuestas ni aprueba KYC; se mantienen las restricciones del servidor.

Validación: 20 pruebas KYC/privacidad aprobadas, incluidas exclusión de campos reservados y perfiles/rutas, y conservación del enlace de siete días y respuestas después de asociar. También pasaron las 13 pruebas generales existentes. Chrome local con datos ficticios: generación de enlace sin ficha, asociación cerrada inicialmente, alta desde respuestas con elección de especialidad, retorno a KYC con nombre/código, duplicado asociado sin alta y ausencia de controles comerciales en Staff. Textos ES/EN comprobados y compilación demo correcta. No se modifica Supabase ni se generan registros públicos durante esta entrega.


## Llenado asistido de KYC — 2026-10-26

Carolina, Mónica y las delegaciones KYC vigentes pueden completar el mismo formulario desde su sesión interna. En Invitación y seguimiento se ofrece Llenar formulario por el proveedor / Continuar llenado asistido. Iniciar requiere motivo y confirmación de que se deshabilita el enlace anterior, conservando las respuestas. No crea otro expediente ni exige ficha comercial.

El formulario conserva campos condicionales, español/inglés, guardado parcial y PDF. Guardar y volver permite retomar desde la cuenta interna. Generar un nuevo enlace termina la asistencia y devuelve el avance al destinatario durante siete días. Versiones de respuesta y de sesión impiden escrituras obsoletas; los tickets de archivo se vinculan al estado y al usuario interno emisor, con comprobación de delegación/MFA en el servidor.

El asistente transcribe información recibida, sin sustituir al declarante: genera el PDF para su revisión y firma, carga la copia firmada y anexos, confirma su correspondencia y pulsa Completar recepción y pasar a revisión. El botón permanece deshabilitado sin PDF vigente, anexos y confirmación. La recepción conserva una instantánea y no aprueba KYC. Los expedientes recibidos solo se editan tras subsanación; no se puede saltar a revisión durante asistencia. Los archivos anteriores y las instantáneas recibidas se conservan.

La migración 018 agrega control de asistencia y revisiones de respuestas en esquema privado. El historial visible a Cumplimiento registra actor, origen, versión y campos cambiados, sin duplicar sus valores sensibles en mensajes. El correo/documento de respaldo de asistencia es opcional. No se ampliaron roles ni se modificaron cuentas.

Validación: 55 pruebas aprobadas (21 KYC/privacidad, 13 generales y 21 directorio/base de datos/identidad). Se verificaron bloqueo de anónimos/lectores/MFA débil, caducidad de delegación, revocación de enlaces y tickets, concurrencia, proyección de campos, firma/anexos, recepción, prohibición de eludir la recepción y conservación de versiones en subsanación. Chrome local: inicio, selección de persona natural, guardado incompleto, historial con actor/campos, recarga y continuidad, formulario de Equipo sin datos societarios, PDF descargado, carga de PDF ficticio y botón final deshabilitado con anexos pendientes. La prueba de recepción completa se ejecutó en PostgreSQL local con archivos ficticios; no se emitió firma real. Supabase confirmó la instalación de la migración 018 y su RPC mediante consulta de metadatos.


## Formulario KYC: usabilidad, documentos y entidades financieras — 2026-10-26

Implementado el lote acordado: navegación directa por las seis secciones con guardado previo (un error de guardado conserva la sección); Anterior y Continuar permanecen. La validación de PDF/envío se mantiene y los pendientes se distinguen en las secciones. Funciona en llenado externo y asistido.

Montos USD: entrada localizada ES 5.000,50 / EN 5,000.50, dos decimales, sin flechas, formato al perder foco, valores canónicos en almacenamiento y formato localizado en PDF. El cero es válido y un campo vacío no se convierte en cero. Los números de cuenta y documentos conservan ceros iniciales.

Entidad financiera: país independiente de nacionalidad; búsqueda por nombre/sigla; bancos antes de cooperativas y otras entidades; Otra permite registrar un nombre solo en ese expediente. Catálogo inicial de 421 entradas: 27 bancos, 387 cooperativas y 7 otras entidades. Fuente bancos consultada 26-10-2026: https://www.superbancos.gob.ec/bancos/catastro-publico/ . Fuente SEPS: segmentación del 01-06-2026, https://www.seps.gob.ec/?download_id=36636&sdm_process_download=1 . Es una ayuda de selección con fecha de corte, no una comprobación en vivo de autorización. Para entidades extranjeras, país y nombre libre. Ecuador muestra Número de cuenta; exterior Número de cuenta o IBAN con explicación, sin exigir ambos.

Propiedad y familia se sustituye por Personas relacionadas. Se mantienen los términos Representante legal, Socios / accionistas y Cónyuge o conviviente. Tipo y número de documento explícitos para representante, cónyuge y socios; país de emisión; RUC personal distinto del RUC de la entidad. No se infiere tipo por longitud de un documento existente: los borradores deben completar esa selección. Formularios fuente originales intactos.

Validaciones: resumen con enlaces, borde e indicación junto al campo, foco en primer error, desaparición al corregir, errores de socios/porcentajes y anexos específicos. Cambiar de sección no exige completitud. Borradores, recepción, firmas, privacidad y delegaciones mantienen sus controles. Migración 019 actualiza proyección/validación y versión del formulario sin modificar respuestas ni documentos históricos ni ampliar permisos.

Validación: 59 pruebas automatizadas aprobadas, incluidas reglas compartidas servidor/navegador, monedas, catálogo, privacidad y recepción asistida. Chrome local: cambio libre de sección, guardado, formato ES/EN, búsqueda JEP, Otra, entidad extranjera, documentos de representante y socios, resumen/foco/limpieza de errores y anexos pendientes. PDF de prueba descargado y reabierto: conserva 5.000,00 / 1.250,50, número de cuenta con ceros y dos áreas de firma. Supabase confirmó la ejecución de la migración 019.

## Mensaje de invitación KYC — 2026-10-27

El botón Copiar mensaje de invitación usa una plantilla ES/EN con saludo, propósito, confidencialidad afirmativa, enlace personal y vencimiento real en hora de Galápagos. Explica guardado, PDF, firma, anexos y envío final; conserva el aviso de datos ficticios del piloto. La firma física aparece solo con la excepción habilitada.

Los anexos proceden de las reglas del formulario: persona natural, jurídica, Equipo GLF o Directorio. Un RUC personal no activa requisitos societarios. Si la clasificación aún no se conoce, los requisitos exclusivos de personas jurídicas se presentan como condicionales. La lista no copia respuestas financieras ni identificaciones de socios. Se usa la clasificación de la ficha comercial únicamente si corresponde al proveedor vinculado.

Validación: cinco pruebas automatizadas aprobadas para rutas nacionales/internacionales, umbral del 10 %, persona natural con RUC, clasificación desconocida, proveedor vinculado, ambos idiomas, fecha/hora, excepción de firma y exclusión de respuestas sensibles. Compilación demo correcta. Chrome local con expediente ficticio: botón de copia devuelve confirmación en español e inglés, sin errores de consola. El contenido se verificó mediante pruebas de la plantilla; la lectura del portapapeles de la herramienta del navegador retornó vacío. Sin migraciones, cambios de permisos ni envío de correos.

## Descarga documental de expedientes KYC — 2026-10-27

Acuerdo implementado: Descargar expediente conserva el ZIP como contenedor, pero elimina expediente.json, manifiesto.json y LEAME.txt. Incluye un resumen e índice en PDF con logotipo GLF, identidad, estado, vigencia, screening, fechas, observaciones, información consignada e historial. Funciona en español e inglés.

Los archivos disponibles se organizan en Formularios, Anexos, Informes y screening y Documentos adicionales. Se conservan los originales byte por byte, todas sus versiones, nombres originales en el índice y referencias al informe/evidencia seleccionados. No se fusionan ni regeneran los PDF firmados. Un documento de una versión anterior no satisface un pendiente de la versión actual; disponible no equivale a validado. Si falta clasificar a la persona se indica que la lista documental es provisional. Un expediente sin archivos entrega únicamente el resumen PDF con sus pendientes. Si falla la recuperación de un archivo, se interrumpe la descarga, sin producir un ZIP incompleto. La información se vuelve a consultar al descargar; no cambian permisos ni almacenamiento.

Validación: 33 pruebas KYC aprobadas, incluidas integridad de originales, versiones, nombres repetidos, rutas seguras, ausencia de JSON/TXT y fallos de descarga. Compilación demo correcta. PDF ES/EN de cinco páginas y expediente inicial de dos páginas reabiertos y revisados visualmente con Poppler. Chrome local: Descargar expediente generó un ZIP, se reabrió y se comprobó el resumen y sus pendientes, sin errores de consola. No se modificaron expedientes reales ni se enviaron correos.

## Presentación sin avisos de piloto — 2026-10-27

Por solicitud expresa del usuario se retiran los avisos de piloto/datos ficticios de la aplicación, formulario externo/asistido, declaración de veracidad, PDF del formulario, resumen del expediente, invitación y guía. Se mantienen confidencialidad, ayuda, guardado, vigencia y controles de acceso. La demostración local conserva su selector de perfiles y la indicación de almacenamiento local. No se cambia el modo de ejecución ni se modifican datos, anexos, firmas o permisos. Los documentos históricos se conservan; el nuevo texto aplica a las próximas generaciones. El usuario avisará cuándo pasar a producción y solicitará el vaciado de la base en ese momento; no se ejecuta ahora.

Validación: ocho pruebas existentes de invitación/exportación aprobadas, compilación demo correcta, formulario externo ES/EN sin banner y declaración sin referencia a prueba verificados en Chrome. PDF del formulario ES/EN y resumen del expediente reabiertos; revisión visual de los textos modificados y sus firmas/encabezados. Sin migraciones ni borrados.

## Nacionalidades normalizadas — 2026-10-27

Nacionalidad pasa de texto libre a un catálogo buscable de 196 opciones en el formulario externo y asistido. Prioriza Ecuador, Estados Unidos, Colombia y Perú, seguidos de países americanos frecuentes, resto de América, Europa, Oceanía, Asia y África. Las opciones muestran gentilicio y país, se buscan sin tildes por gentilicio, país o alias y se guardan con una única forma canónica en español femenino. La presentación inglesa usa gentilicios ingleses sin cambiar el valor guardado. No se selecciona una nacionalidad por defecto.

Fuente lingüística: https://www.rae.es/dpd/ayuda/paises-y-capitales-con-sus-gentilicios . La nacionalidad permanece independiente de residencia y país del documento. Se conservan los valores anteriores no reconocidos con una indicación para seleccionar la forma normalizada; no hay actualización masiva de respuestas históricas. Resumen y PDF muestran el nombre según el idioma solicitado.

Validación: 34 pruebas KYC aprobadas y compilación demo correcta. Chrome local: catálogo y orden, búsqueda japon sin tilde, selección Japonesa, cambio de sección, guardado y persistencia tras recarga; traducción Japanese con valor canónico Japonesa; búsqueda sin resultados conserva la selección. Revisión visual del campo. Sin migraciones, cambios de permisos ni modificaciones de expedientes reales.

