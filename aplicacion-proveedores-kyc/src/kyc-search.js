const normal=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export function searchDemoCases(cases,suppliers,query='',offset=0){
 const q=normal(query),compact=q.replaceAll(' ','');
 const rows=cases.map(c=>{const s=suppliers.find(s=>s.id===c.supplier_id)||{},a=c.answers||{};
  const ids=[[a.idType,a.id,a.country],['ruc',a.taxId,a.country],[s.id_type,s.id_number,s.id_country_code],['ruc',s.tax_number,s.id_country_code]].filter(([,n])=>String(n||'').trim());
  const identifications=Array.from(new Map(ids.map(([type,number,country])=>[JSON.stringify([type,number,country]),{type,number,country}])).values());
  const names=normal([c.name,a.name,s.legal_name,s.trade_name].filter(Boolean).join(' '));
  return {c,identifications,names};
 }).filter(r=>!q||q.split(' ').every(w=>r.names.includes(w))||r.identifications.some(d=>normal(d.number).replaceAll(' ','').includes(compact)))
 .sort((a,b)=>String(b.c.updated_at).localeCompare(String(a.c.updated_at))||b.c.id.localeCompare(a.c.id));
 return {total:rows.length,items:rows.slice(offset,offset+50).map(({c,identifications})=>({...c,identifications}))};
}
