import {internalManual} from './manual-internal-data.js';
import {manualHtml,bindManual} from './manual-ui.js';
export const html=lang=>manualHtml(internalManual,lang);
export const bind=(root,lang)=>bindManual(root,internalManual,lang);
