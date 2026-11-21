// Views are filters over existing documents, never additional lifecycle states.
export const recordViews={
 incoming:[['all','Todos los recibidos','All incoming',[]],['attention','En atención','In progress',['received','assigned']],['closed','Cerrados','Closed',['closed']]],
 outgoing:[['drafts','Borradores','Drafts',['draft']],['signature','Para firma','For signature',['review','prepared']],['dispatch','Por enviar','Pending dispatch',['signed']],['sent','Enviados','Sent',['sent']],['all','Todos los emitidos','All outgoing',[]]]
};
export const viewStates=(direction,view)=>recordViews[direction]?.find(v=>v[0]===view)?.[3]||[];
export function viewTitle(direction,view,lang){return recordViews[direction]?.find(v=>v[0]===view)?.[lang==='es'?1:2]||'';}
export const workspaceKey=(direction,view)=>direction+':'+view;
