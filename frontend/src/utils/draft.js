// Non-sensitive estimator prefill handed from the public site to the booking wizard.
const KEY = 'kpm-quote-draft'
export const saveQuoteDraft = (d) => { try { sessionStorage.setItem(KEY, JSON.stringify(d)) } catch { /* storage unavailable */ } }
export const loadQuoteDraft = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') } catch { return null } }
export const clearQuoteDraft = () => { try { sessionStorage.removeItem(KEY) } catch { /* noop */ } }
