// Public support contact, configurable at deployment; never an authentication identity.
const configured=typeof __CONFIG__!=='undefined'?__CONFIG__.kycSupportEmail:'';
export const kycSupportEmail=/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(configured||'')?configured:'carolina.astudillo@glf.org.ec';
export const supportText=value=>value.replaceAll('carolina.astudillo@glf.org.ec',kycSupportEmail);
