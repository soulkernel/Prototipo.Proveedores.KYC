// Display formatting is separate from canonical decimal strings stored in answers.
export function parseMoney(value,lang='es'){
 const raw=String(value??'').trim();if(!raw)return '';
 const group=lang==='en'?',':'.',decimal=lang==='en'?'.':',';
 const escaped=group==='.'?'\\.':group;
 const pattern=new RegExp('^(?:[0-9]+|[0-9]{1,3}(?:'+escaped+'[0-9]{3})+)(?:'+(decimal==='.'?'\\.':decimal)+'[0-9]{1,2})?$');
 if(!pattern.test(raw))return null;
 const canonical=raw.split(group).join('').replace(decimal,'.');
 if(Number(canonical)>999999999999.99)return null;
 return canonical.replace(/^0+(?=\d)/,'');
}
export function formatMoney(value,lang='es'){
 if(value===''||value==null)return '';
 if(!/^\d+(\.\d{1,2})?$/.test(String(value)))return String(value).replace(/^!/, '');
 return new Intl.NumberFormat(lang==='en'?'en-US':'de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value));
}
export const moneyKeys=new Set(['monthlyIncome','monthlyExpenses']);
export const documentTypes=['cedula','ruc','passport','foreign_id','tax_id'];
export function documentNumberLabel(type,lang='es'){
 return ({cedula:['Número de cédula','National ID number'],ruc:['Número de RUC','RUC number'],passport:['Número de pasaporte','Passport number'],foreign_id:['Número de documento de identidad extranjero','Foreign identity document number'],tax_id:['Número de registro tributario extranjero','Foreign tax registration number']})[type]?.[lang==='en'?1:0]||(lang==='en'?'Document number':'Número de documento');
}
export function validRelatedId(type,id,country){
 if(!documentTypes.includes(type)||!id||id.length>60)return false;
 if(['cedula','ruc'].includes(type))return country==='EC'&&new RegExp(type==='ruc'?'^\\d{13}$':'^\\d{10}$').test(id);
 return true;
}

