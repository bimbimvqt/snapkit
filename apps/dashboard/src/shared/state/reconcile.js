// API snapshots are immutable. Reuse unchanged branches so background sync does
// not propagate fresh references through every feature on the screen.
export function reconcileSnapshot(previous,next){
 if(Object.is(previous,next))return previous;
 if(!previous||!next||typeof previous!=='object'||typeof next!=='object'||Array.isArray(previous)!==Array.isArray(next))return next;
 const keys=Object.keys(next),oldKeys=Object.keys(previous);let same=keys.length===oldKeys.length;
 const result=Array.isArray(next)?[]:{...next};
 const indexed=Array.isArray(previous)&&previous.every(x=>x&&typeof x==='object'&&typeof x.id==='string')?new Map(previous.map(x=>[x.id,x])):null;
 for(const key of keys){const value=next[key],old=indexed&&value?.id?indexed.get(value.id):previous[key];result[key]=reconcileSnapshot(old,value);if(!Object.hasOwn(previous,key)||result[key]!==previous[key])same=false;}
 return same?previous:result;
}
