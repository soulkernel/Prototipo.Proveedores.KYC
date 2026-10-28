import {documents,documentLabel} from './kyc-model.js';

// New minimal cases may carry the database's default `natural`. Do not treat
// that default as a confirmed classification, or infer a company from a RUC.
export function invitationPerson(row,supplier){
 const a=row.answers||{};
 if(['staff','board'].includes(row.relation))return 'natural';
 if(a.person==='legal')return 'legal';
 if(a.person==='natural'&&(a.id||a.birthDate||a.nationality))return 'natural';
 if(supplier&&supplier.id===row.supplier_id&&['natural','legal'].includes(supplier.person_type))return supplier.person_type;
 return null;
}

export function invitationDocuments(row,lang='es',supplier=null){
 const en=lang==='en',t=(es,enText)=>en?enText:es;
 const person=invitationPerson(row,supplier),internal=['staff','board'].includes(row.relation);
 const answers={...row.answers,relation:row.relation,person:person||'natural'};
 // Use the same annex rule as the form. Unknown classifications show the union,
 // with company-only requirements explicitly conditional.
 const slots=new Set(documents(answers).filter(k=>k!=='signed'&&!k.startsWith('owner_')));
 if(!person&&!internal)documents({...answers,person:'legal'}).filter(k=>k!=='signed'&&!k.startsWith('owner_')).forEach(k=>slots.add(k));
 const descriptions={
  identity:person==='legal'?t('Copia del documento de identidad del representante legal.','Copy of the legal representative’s identity document.'):!person?t('Copia de su documento de identidad o del representante legal, si actúa en nombre de una entidad.','Copy of your identity document, or the legal representative’s document if acting on behalf of an entity.'):t('Copia de su documento de identidad: cédula, pasaporte o documento equivalente, según corresponda.','Copy of your identity document: national ID, passport or equivalent, as applicable.'),
  tax:person==='legal'?t('Copia del RUC o documento de identificación tributaria de la entidad.','Copy of the entity’s RUC or tax registration document.'):t('Copia del RUC o documento de identificación tributaria correspondiente.','Copy of the applicable RUC or tax registration document.'),
  bank:t('Certificado bancario.','Bank certificate.'),
  address_doc:t('Copia de un servicio básico (agua, luz o teléfono) de los últimos tres meses, donde conste la dirección de domicilio.','Copy of a utility bill (water, electricity or telephone) from the last three months showing the residential or registered address.'),
  appointment:t('Nombramiento o acreditación del representante legal.','Appointment or proof of authority of the legal representative.'),
  cv:t('Hoja de vida (CV).','CV / résumé.')
 };
 const result=[...slots].map(key=>({key,text:(!person&&key==='appointment'?t('Si es persona jurídica: ','If you are a legal entity: '):'')+(descriptions[key]||documentLabel(key,answers,lang))}));
 if(!internal&&person!=='natural')result.push({key:'owners',text:t((!person?'Si es persona jurídica y corresponde: ':'Cuando corresponda: ')+'documentos de identidad de los socios o accionistas con participación del 10 % o más.',(!person?'If you are a legal entity and this applies: ':'Where applicable: ')+'identity documents for owners or shareholders with ownership of 10% or more.')});
 return result;
}

export function invitationMessage(row,invitation,lang='es',supplier=null){
 const en=lang==='en',locale=en?'en-GB':'es-EC',expiry=new Date(invitation.expires_at);
 if(Number.isNaN(expiry.getTime())||!invitation.url)throw Error('INVALID_INVITATION');
 const date=new Intl.DateTimeFormat(locale,{dateStyle:'long',timeZone:'Pacific/Galapagos'}).format(expiry);
 const time=new Intl.DateTimeFormat(locale,{timeStyle:'short',hour12:true,timeZone:'Pacific/Galapagos'}).format(expiry);
 const code='KYC-'+String(row.code).padStart(5,'0'),name=String(row.name||'').replace(/[\r\n]+/g,' ').trim();
 const attachments=invitationDocuments(row,lang,supplier).map(d=>'- '+d.text).join('\n');
 const signature=en?row.allow_scan?'Review it and sign electronically. GLF has also authorized a handwritten signature for this case: you may print, sign and upload a legible scanned PDF. Keep the original and provide it only if Carolina requests it.':'Review it and sign electronically.':row.allow_scan?'Revíselo y fírmelo electrónicamente. GLF también ha autorizado la firma física para este expediente: puede imprimirlo, firmarlo a mano y subir un PDF escaneado legible. Conserve el original y entréguelo solo si Carolina lo solicita.':'Revíselo y fírmelo electrónicamente.';
 if(en)return `Subject: GLF | KYC information and documentation request — ${code}

Dear ${name},

Greetings from Galápagos Life Fund (GLF).

As part of our due diligence and compliance process, please complete the KYC form. This process allows us to verify the identity and information of the individuals and entities with which GLF has a relationship.

The information and documents you provide will be treated confidentially and will be available only to authorized personnel.

Access your form through this personal link:
${invitation.url}

Access to the link for entering your information will be available until ${date}, at ${time} (Galápagos time). Until then, you can complete the form and resume your progress from any device.

Your progress is saved automatically. Wait for the save confirmation before closing. Do not share or forward this link.

To complete the process:
1. Fill in the requested information.
2. Generate and download the completed form as a PDF.
3. ${signature}
4. Upload the signed form and the additional documents listed below through the form.
5. Click “Submit”. You will receive an on-screen confirmation with the date and time of receipt. Once submitted, the link will no longer allow editing.

Additional required documents:
${attachments}

The form will show the documents applicable to your answers. Documents can be PDF, JPG or PNG, up to 10 MB each. The signed form must be a PDF.

If you need assistance completing the form or the link has expired, contact carolina.astudillo@glf.org.ec.

Thank you for your cooperation.

Carolina Astudillo
Galápagos Life Fund · GLF`;
 return `Asunto: GLF | Solicitud de información y documentación KYC — ${code}

Estimado/a ${name}:

Reciba un cordial saludo de Galápagos Life Fund (GLF).

Como parte de nuestro proceso de debida diligencia y cumplimiento, le solicitamos completar el formulario KYC. Este proceso permite verificar la identidad y la información de las personas y entidades con las que GLF mantiene una relación.

La información y los documentos proporcionados se tratarán en forma confidencial y estarán disponibles únicamente para el personal autorizado.

Puede acceder al formulario mediante su enlace personal:
${invitation.url}

El acceso al enlace para consignar la información estará disponible hasta el ${date}, a las ${time} (hora de Galápagos). Hasta ese momento, podrá completar el formulario y retomar su avance desde cualquier dispositivo.

Su avance se guarda automáticamente. Espere la confirmación de guardado antes de cerrar. No comparta ni reenvíe este enlace.

Para completar el proceso:
1. Llene la información solicitada.
2. Genere y descargue el PDF del formulario completo.
3. ${signature}
4. Adjunte a través del formulario el PDF firmado y los documentos adicionales indicados a continuación.
5. Pulse «Enviar». Recibirá una confirmación en pantalla con la fecha y hora de recepción. Una vez enviado, el enlace dejará de permitir la edición.

Documentos adicionales requeridos:
${attachments}

El formulario mostrará los documentos que correspondan a sus respuestas. Puede adjuntar documentos en PDF, JPG o PNG, de hasta 10 MB cada uno. El formulario firmado debe ser PDF.

Si necesita ayuda para completar el formulario o si el enlace ha vencido, comuníquese con carolina.astudillo@glf.org.ec.

Gracias por su colaboración.

Carolina Astudillo
Galápagos Life Fund · GLF`;
}

