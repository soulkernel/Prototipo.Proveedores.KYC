export const activitySections=[
 {title:['Actividad y relación con el GLF','Activity and relationship with GLF'],help:['Indique a qué se dedica y, por separado, qué bienes o servicios proporcionará al GLF.','Describe what you do and, separately, the goods or services you will provide to GLF.'],keys:['activity','services','website']},
 {title:['Información económica','Financial information'],keys:['monthlyIncome','monthlyExpenses']},
 {title:['Información bancaria','Bank account information'],keys:['bankName','bankCountry','bankHolder','bankAccount']}
];
export function activityFieldHelp(key,person,lang='es'){
 const legal=person==='legal',t=(es,en)=>lang==='en'?en:es;
 if(key==='monthlyIncome')return legal?t('Indique el total aproximado que recibe mensualmente la entidad por sus distintas actividades, no solo por su relación con el GLF.','Enter the entity’s approximate total monthly income from all its activities, not only its relationship with GLF.'):t('Indique el total aproximado que recibe mensualmente por sus distintas actividades, no solo por su relación con el GLF.','Enter your approximate total monthly income from all your activities, not only your relationship with GLF.');
 if(key==='monthlyExpenses')return legal?t('Indique el total aproximado de los gastos mensuales de la entidad.','Enter the entity’s approximate total monthly expenses.'):t('Indique el total aproximado de sus gastos mensuales como persona declarante.','Enter your approximate total monthly expenses as the individual applicant.');
 if(key==='bankName')return t('Seleccione la entidad financiera en la que mantiene la cuenta bancaria que declara en este formulario.','Select the financial institution where you hold the bank account declared in this form.');
 if(key==='bankCountry')return t('Indique el país donde mantiene esa cuenta bancaria. Para una entidad del catálogo ecuatoriano se completa Ecuador; use Otra entidad / Entidad extranjera para registrar una cuenta de otro país.','Indicate the country where you hold this bank account. Ecuador is filled in for an institution from the Ecuadorian catalog; use Other institution / Foreign institution for an account in another country.');
 if(key==='bankHolder')return t('Escriba el nombre del titular tal como aparece en el certificado bancario.','Enter the account holder’s name exactly as it appears on the bank certificate.');
 return '';
}
