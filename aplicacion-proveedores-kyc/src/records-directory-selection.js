export const directoryGroups=['all','suppliers','institutions','individuals','contacts'];
export function directoryGroupLabel(group,lang='es'){
 const labels={all:['Todo el directorio','Entire directory'],suppliers:['Proveedores','Suppliers'],institutions:['Instituciones y entidades','Institutions and entities'],individuals:['Personas naturales','Individuals'],contacts:['Solo contactos','Contacts only']};
 return (labels[group]||labels.all)[lang==='es'?0:1];
}
// Classify the counterpart, not its representative or contact person.
export function directoryCategory(p){return p.supplier_id?'suppliers':p.kind==='natural'?'individuals':'institutions';}
export function selectDirectory(parties,group='all'){
 const seen=new Set();
 return parties.filter(p=>{
  // Never merge different counterparts on name/email: either may be shared.
  if(p.id){if(seen.has(p.id))return false;seen.add(p.id);}
  return ['all','contacts'].includes(group)||(group==='suppliers'?!!p.supplier_id:group==='institutions'?p.kind!=='natural'&&(!p.supplier_id||p.administrative):group==='individuals'?p.kind==='natural'&&!p.supplier_id:directoryCategory(p)===group);
 });
}
