// Catalog labels use the feminine form of "nacionalidad", independently of gender.
// Spanish reference: RAE, Países y capitales con sus gentilicios (checked 2026-10-27).
// https://www.rae.es/dpd/ayuda/paises-y-capitales-con-sus-gentilicios
// Store the Spanish catalog value in the existing nationality field in either UI language.
const groups={
 americas:`EC|Ecuatoriana|Ecuadorian|ecuatoriano,ecu
US|Estadounidense|American|estadunidense,usa,eeuu,ee. uu.,united states
CO|Colombiana|Colombian|colombiano
PE|Peruana|Peruvian|peruano
VE|Venezolana|Venezuelan|venezolano
AR|Argentina|Argentinian|argentino,argentine
BO|Boliviana|Bolivian|boliviano
BR|Brasileña|Brazilian|brasileño,brasilera,brasilero
CL|Chilena|Chilean|chileno
PY|Paraguaya|Paraguayan|paraguayo
UY|Uruguaya|Uruguayan|uruguayo
GY|Guyanesa|Guyanese|guyanés
SR|Surinamesa|Surinamese|surinamés
MX|Mexicana|Mexican|mexicano
CA|Canadiense|Canadian|
BZ|Beliceña|Belizean|beliceño
CR|Costarricense|Costa Rican|
SV|Salvadoreña|Salvadoran|salvadoreño
GT|Guatemalteca|Guatemalan|guatemalteco
HN|Hondureña|Honduran|hondureño
NI|Nicaragüense|Nicaraguan|
PA|Panameña|Panamanian|panameño
AG|Antiguana|Antiguan and Barbudan|antiguano
BS|Bahameña|Bahamian|bahameño
BB|Barbadense|Barbadian|
CU|Cubana|Cuban|cubano
DM|Dominiquesa|Dominican (Dominica)|dominiqués
DO|Dominicana|Dominican (Dominican Republic)|dominicano
GD|Granadina|Grenadian|granadino
HT|Haitiana|Haitian|haitiano
JM|Jamaiquina|Jamaican|jamaiquino,jamaicana,jamaicano
KN|Sancristobaleña|Kittitian and Nevisian|sancristobaleño
LC|Santalucense|Saint Lucian|
VC|Sanvicentina|Vincentian|sanvicentino
TT|Trinitense|Trinidadian and Tobagonian|
PR|Puertorriqueña|Puerto Rican|puertorriqueño`,
 europe:`AL|Albanesa|Albanian|albanés
AD|Andorrana|Andorran|andorrano
AT|Austriaca|Austrian|austriaco,austríaca,austríaco
BY|Bielorrusa|Belarusian|bielorruso
BE|Belga|Belgian|
BA|Bosnia|Bosnian and Herzegovinian|bosnio,bosnioherzegovina,bosnioherzegovino
BG|Búlgara|Bulgarian|búlgaro
HR|Croata|Croatian|
CY|Chipriota|Cypriot|
CZ|Checa|Czech|checo
DK|Danesa|Danish|danés
EE|Estonia|Estonian|estonio
FI|Finlandesa|Finnish|finlandés
FR|Francesa|French|francés
DE|Alemana|German|alemán
GR|Griega|Greek|griego
HU|Húngara|Hungarian|húngaro
IS|Islandesa|Icelandic|islandés
IE|Irlandesa|Irish|irlandés
IT|Italiana|Italian|italiano
LV|Letona|Latvian|letón
LI|Liechtensteiniana|Liechtensteiner|liechtensteiniano
LT|Lituana|Lithuanian|lituano
LU|Luxemburguesa|Luxembourgish|luxemburgués
MT|Maltesa|Maltese|maltés
MD|Moldava|Moldovan|moldavo
MC|Monegasca|Monégasque|monegasco
ME|Montenegrina|Montenegrin|montenegrino
NL|Neerlandesa|Dutch|neerlandés,holandesa,holandés
MK|Macedonia|Macedonian|macedonio
NO|Noruega|Norwegian|noruego
PL|Polaca|Polish|polaco
PT|Portuguesa|Portuguese|portugués
RO|Rumana|Romanian|rumano
RU|Rusa|Russian|ruso
SM|Sanmarinense|Sammarinese|
RS|Serbia|Serbian|serbio
SK|Eslovaca|Slovak|eslovaco
SI|Eslovena|Slovenian|esloveno
ES|Española|Spanish|español
SE|Sueca|Swedish|sueco
CH|Suiza|Swiss|suizo
UA|Ucraniana|Ukrainian|ucraniano
GB|Británica|British|británico,uk,reino unido,united kingdom
VA|Vaticana|Vatican|vaticano`,
 oceania:`AU|Australiana|Australian|australiano
FJ|Fiyiana|Fijian|fiyiano
KI|Kiribatiana|I-Kiribati|kiribatiano
MH|Marshalesa|Marshallese|marshalés
FM|Micronesia|Micronesian|micronesio
NR|Nauruana|Nauruan|nauruano
NZ|Neozelandesa|New Zealander|neozelandés
PW|Palauana|Palauan|palauano
PG|Papú|Papua New Guinean|papua
WS|Samoana|Samoan|samoano
SB|Salomonense|Solomon Islander|
TO|Tongana|Tongan|tongano
TV|Tuvaluana|Tuvaluan|tuvaluano
VU|Vanuatuense|Ni-Vanuatu|vanuatense`,
 asia:`AF|Afgana|Afghan|afgano
AM|Armenia|Armenian|armenio
AZ|Azerbaiyana|Azerbaijani|azerbaiyano,azerí
BH|Bareiní|Bahraini|
BD|Bangladesí|Bangladeshi|
BT|Butanesa|Bhutanese|butanés
BN|Bruneana|Bruneian|bruneano
KH|Camboyana|Cambodian|camboyano
CN|China|Chinese|chino
GE|Georgiana|Georgian|georgiano
IN|India|Indian|indio
ID|Indonesia|Indonesian|indonesio
IR|Iraní|Iranian|
IQ|Iraquí|Iraqi|
IL|Israelí|Israeli|
JP|Japonesa|Japanese|japonés
JO|Jordana|Jordanian|jordano
KZ|Kazaja|Kazakh|kazajo
KW|Kuwaití|Kuwaiti|
KG|Kirguisa|Kyrgyz|kirguís
LA|Laosiana|Lao|laosiano
LB|Libanesa|Lebanese|libanés
MY|Malasia|Malaysian|malasio
MV|Maldiva|Maldivian|maldivo
MN|Mongola|Mongolian|mongol
MM|Birmana|Burmese|birmano,myanmar
NP|Nepalí|Nepalese|
KP|Norcoreana|North Korean|norcoreano
OM|Omaní|Omani|
PK|Pakistaní|Pakistani|
PS|Palestina|Palestinian|palestino
PH|Filipina|Filipino|filipino
QA|Catarí|Qatari|qatarí
SA|Saudí|Saudi|saudita
SG|Singapurense|Singaporean|
KR|Surcoreana|South Korean|surcoreano
LK|Esrilanquesa|Sri Lankan|esrilanqués
SY|Siria|Syrian|sirio
TJ|Tayika|Tajik|tayiko
TH|Tailandesa|Thai|tailandés
TL|Timorense|Timorese|
TR|Turca|Turkish|turco
TM|Turcomana|Turkmen|turcomano
AE|Emiratí|Emirati|
UZ|Uzbeka|Uzbek|uzbeko
VN|Vietnamita|Vietnamese|
YE|Yemení|Yemeni|yemenita`,
 africa:`DZ|Argelina|Algerian|argelino
AO|Angoleña|Angolan|angoleño,angolana,angolano
BJ|Beninesa|Beninese|beninés
BW|Botsuana|Botswanan|botsuano
BF|Burkinesa|Burkinabè|burkinés
BI|Burundesa|Burundian|burundés
CV|Caboverdiana|Cabo Verdean|caboverdiano
CM|Camerunesa|Cameroonian|camerunés
CF|Centroafricana|Central African|centroafricano
TD|Chadiana|Chadian|chadiano
KM|Comorense|Comorian|
CG|Congoleña (República del Congo)|Congolese (Republic of the Congo)|
CD|Congoleña (República Democrática del Congo)|Congolese (Democratic Republic of the Congo)|
CI|Marfileña|Ivorian|marfileño
DJ|Yibutiana|Djiboutian|yibutiano
EG|Egipcia|Egyptian|egipcio
GQ|Ecuatoguineana|Equatorial Guinean|ecuatoguineano
ER|Eritrea|Eritrean|eritreo
SZ|Suazi|Swazi|suazilandesa,suazilandés,esuatini,eswatini
ET|Etíope|Ethiopian|
GA|Gabonesa|Gabonese|gabonés
GM|Gambiana|Gambian|gambiano
GH|Ghanesa|Ghanaian|ghanés
GN|Guineana|Guinean|guineano
GW|Guineana (Guinea-Bisáu)|Bissau-Guinean|guineano de bisau
KE|Keniata|Kenyan|keniana,keniano
LS|Lesotense|Basotho|
LR|Liberiana|Liberian|liberiano
LY|Libia|Libyan|libio
MG|Malgache|Malagasy|
MW|Malauí|Malawian|
ML|Maliense|Malian|malí
MR|Mauritana|Mauritanian|mauritano
MU|Mauriciana|Mauritian|mauriciano
MA|Marroquí|Moroccan|
MZ|Mozambiqueña|Mozambican|mozambiqueño
NA|Namibia|Namibian|namibio
NE|Nigerina|Nigerien|nigerino
NG|Nigeriana|Nigerian|nigeriano
RW|Ruandesa|Rwandan|ruandés
ST|Santotomense|São Toméan|
SN|Senegalesa|Senegalese|senegalés
SC|Seychellense|Seychellois|
SL|Sierraleonesa|Sierra Leonean|sierraleonés
SO|Somalí|Somali|
ZA|Sudafricana|South African|sudafricano
SS|Sursudanesa|South Sudanese|sursudanés
SD|Sudanesa|Sudanese|sudanés
TZ|Tanzana|Tanzanian|tanzano
TG|Togolesa|Togolese|togolés
TN|Tunecina|Tunisian|tunecino
UG|Ugandesa|Ugandan|ugandés
ZM|Zambiana|Zambian|zambiano
ZW|Zimbabuense|Zimbabwean|zimbabuano,zimbabuana`
};
export const nationalityGroups={priority:['Acceso rápido','Quick access'],americas:['América y el Caribe','Americas and Caribbean'],europe:['Europa','Europe'],oceania:['Oceanía','Oceania'],asia:['Asia','Asia'],africa:['África','Africa']};
const priority=['EC','US','CO','PE','VE','CL','AR','BR','MX','CA'];
const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
const names={es:new Intl.DisplayNames(['es'],{type:'region'}),en:new Intl.DisplayNames(['en'],{type:'region'})};
export const nationalities=Object.entries(groups).flatMap(([region,rows])=>rows.split('\n').map(line=>{const [code,es,en,aliases]=line.split('|');return {code,es,en,region,group:priority.includes(code)?'priority':region,aliases:(aliases||'').split(',').filter(Boolean)};}));
export function resolveNationality(value){
 const q=normalize(value);if(!q)return null;
 return nationalities.find(n=>[n.es,n.en,n.code,names.es.of(n.code),names.en.of(n.code),...n.aliases].some(v=>normalize(v)===q))||null;
}
export function nationalityLabel(value,lang='es'){const n=resolveNationality(value);return n?n[lang==='en'?'en':'es']:String(value||'');}
export function nationalityOptions(query='',lang='es'){
 const q=normalize(query),order=Object.keys(nationalityGroups);
 return nationalities.filter(n=>!q||[n.es,n.en,n.code,names.es.of(n.code),names.en.of(n.code),...n.aliases].some(v=>normalize(v).includes(q))).sort((a,b)=>order.indexOf(a.group)-order.indexOf(b.group)||(a.group==='priority'?priority.indexOf(a.code)-priority.indexOf(b.code):a[lang==='en'?'en':'es'].localeCompare(b[lang==='en'?'en':'es'],lang)));
}

