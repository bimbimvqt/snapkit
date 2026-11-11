import {toast} from '../../legacy/device-controller.js';
// Transient action acknowledgements belong in the shared, accessible toast region.
export function useActionFeedback():[string,(message:string)=>void]{return ['',message=>{if(message)toast(message,/could not|cannot|denied|invalid|failed|cannot be converted/i.test(message));}];}
