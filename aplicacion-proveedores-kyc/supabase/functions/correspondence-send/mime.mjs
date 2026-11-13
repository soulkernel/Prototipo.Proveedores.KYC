const encoder=new TextEncoder();
const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const encoded=s=>{const words=[];let part='';for(const char of s){if(encoder.encode(part+char).length>42){words.push('=?UTF-8?B?'+b64(encoder.encode(part))+'?=');part='';}part+=char;}if(part)words.push('=?UTF-8?B?'+b64(encoder.encode(part))+'?=');return words.join('\r\n ');};
const fold=s=>b64(encoder.encode(s)).match(/.{1,76}/g)?.join('\r\n')||'';
export function buildMail({from,to,cc='',replyTo,subject,message,attachments,messageId}){
 for(const s of [from,to,cc,replyTo||''])if(/[\r\n]/.test(s))throw Error('INVALID_HEADER');
 for(const email of [from,...to.split(',').map(s=>s.trim()),...(cc?cc.split(',').map(s=>s.trim()):[]),...(replyTo?[replyTo]:[])])if(!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email))throw Error('INVALID_EMAIL');
 if(/[\r\n]/.test(subject)||!/^[A-Za-z0-9@.<>_-]+$/.test(messageId))throw Error('INVALID_HEADER');
 const boundary='glf_'+crypto.randomUUID().replaceAll('-','');
 const lines=[`From: ${from}`,`To: ${to}`,...(cc?[`Cc: ${cc}`]:[]),...(replyTo?[`Reply-To: ${replyTo}`]:[]),`Subject: ${encoded(subject)}`,`Message-ID: <${messageId}>`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',fold(message)];
 for(const f of attachments){if(!['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(f.mime))throw Error('INVALID_ATTACHMENT');const name=encodeURIComponent(f.filename).replaceAll("'",'%27');lines.push(`--${boundary}`,`Content-Type: ${f.mime}`,`Content-Disposition: attachment; filename*=UTF-8''${name}`,'Content-Transfer-Encoding: base64','',b64(f.bytes).match(/.{1,76}/g)?.join('\r\n')||'');}
 lines.push(`--${boundary}--`,'');return b64(encoder.encode(lines.join('\r\n'))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
