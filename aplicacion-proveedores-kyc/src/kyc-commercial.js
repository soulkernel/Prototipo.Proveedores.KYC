import {emptySupplier} from './domain.js';

export function canPrepareSupplier(c){
 return !!c?.receipt_at&&!c.supplier_id&&['supplier','consultant'].includes(c.relation)&&['submitted','review','approved','not_approved'].includes(c.state);
}

// Explicit commercial allowlist. Never spread the private answers into a supplier.
export function supplierDraftFromKyc(c,scope){
 if(!canPrepareSupplier(c))throw Error('INVALID_STATE');
 const a=c.answers||{},country=a.residenceCountry||a.country||'';
 let countryName='';try{countryName=new Intl.DisplayNames(['es'],{type:'region'}).of(country);}catch{}
 return {...emptySupplier(scope),person_type:a.person||'',id_country_code:a.country||'',id_type:a.idType||'',id_number:a.id||'',tax_number:['ruc','tax_id'].includes(a.idType)?(a.id||''):(a.taxId||''),legal_name:a.name||c.name,email:a.email||c.email,phone:a.phone||'',country_code:country,country_name:countryName,city:a.city||'',description:a.services||a.activity||'',legal_rep_name:a.person==='legal'?(a.legalRep||''):''};
}
