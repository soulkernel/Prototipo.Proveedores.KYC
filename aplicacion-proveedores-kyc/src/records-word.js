import JSZip from 'jszip';
// Import text deliberately; keep the original DOCX as evidence. Never execute macros or external relationships.
export async function extractWord(blob){
 if(blob.size>20*1024*1024)throw Error('INVALID_FILE');
 const zip=await JSZip.loadAsync(await blob.arrayBuffer());const entry=zip.file('word/document.xml');
 if(!entry||entry._data?.uncompressedSize>2*1024*1024)throw Error('INVALID_FILE');
 const xml=await entry.async('string');if(xml.length>2*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('INVALID_FILE');
 const parser=new DOMParser(),doc=parser.parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw Error('INVALID_FILE');
 const text=[...doc.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('')).join('\n\n').trim();
 if(!text||text.length>60000)throw Error('INVALID_FILE');return text;
}
