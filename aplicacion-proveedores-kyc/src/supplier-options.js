// INEC: https://www.ecuadorencifras.gob.ec/fasciculos-provinciales/
export const provinces=['Azuay','Bolívar','Cañar','Carchi','Chimborazo','Cotopaxi','El Oro','Esmeraldas','Galápagos','Guayas','Imbabura','Loja','Los Ríos','Manabí','Morona Santiago','Napo','Orellana','Pastaza','Pichincha','Santa Elena','Santo Domingo de los Tsáchilas','Sucumbíos','Tungurahua','Zamora Chinchipe'];
export const galapagosCantons=['Santa Cruz','San Cristóbal','Isabela'];
export const emailLabels=['sales','billing','contactEmail','other'];
export function identityTypes(person,country){return country==='EC'?(person==='legal'?['ruc']:['cedula','ruc']):(person==='legal'?['tax_id','business_registry']:['passport','foreign_id']);}
