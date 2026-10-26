export const riskMonths={high:12,medium:24,low:36};
export const dayAt=v=>v?new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Galapagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v)):'';
export function addMonths(day,months){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isInteger(months)||months<1)return '';const [y,m,d]=day.split('-').map(Number),date=new Date(Date.UTC(y,m-1+months,1));date.setUTCDate(Math.min(d,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()));return date.toISOString().slice(0,10);}
export function validity(c,today=dayAt(new Date())){if(!c)return 'none';if(!['approved','not_approved'].includes(c.state))return 'in_progress';if(c.state==='not_approved')return 'not_cleared';if(!c.review_due_on)return 'unverified';return c.review_due_on<today?'expired':'valid';}
export const validityLabels={none:['Sin evaluación KYC','No KYC assessment'],in_progress:['Proceso en curso','Assessment in progress'],not_cleared:['No conforme','Not cleared'],unverified:['Vigencia pendiente de verificar','Validity requires verification'],expired:['KYC vencido','KYC expired'],valid:['KYC vigente','KYC valid']};
export function scheduleDecision(c,files,state,options,confirmed){
 if(!['submitted','review','correction'].includes(c.state)||!confirmed)throw Error('INVALID_REVIEW');
 if(options.expected!==c.review_version)throw Error('STALE_VERSION');
 if(!riskMonths[options.risk])throw Error('RISK_REQUIRED');
 const report=files.find(f=>f.id===options.report&&f.slot==='report'&&f.version===c.version);if(!report)throw Error('REPORT_REQUIRED');
 const base=dayAt(report.created_at);if(!options.issued||options.issued>base)throw Error('INVALID_REPORT_DATE');
 const standard=addMonths(base,riskMonths[options.risk]),due=state==='approved'?(options.due||standard):null,reason=(options.reason||'').trim();
 if(due&&due<=base)throw Error('INVALID_REVIEW_DATE');if(reason.length>1000||due&&due!==standard&&reason.length<5)throw Error('SCHEDULE_REASON_REQUIRED');
 if(due>standard&&!options.exception)throw Error('POLICY_EXCEPTION_REQUIRED');
 return {risk_level:options.risk,final_report_id:report.id,report_issued_on:options.issued,report_uploaded_at:report.created_at,closed_at:new Date().toISOString(),policy_due_on:state==='approved'?standard:null,review_due_on:due,schedule_reason:reason,schedule_exception:!!(due&&due>standard),review_version:c.review_version+1};
}
