// A shared start kit carries intent, never executable commands, local paths or secrets.
export function sharedStartKit(input){
 if(!input||typeof input!=='object'||typeof input.openEditor!=='boolean'||typeof input.compose!=='boolean'||!Array.isArray(input.ports)||input.ports.length>8||input.ports.some(p=>!Number.isInteger(p)||p<1024||p>65535))throw Error('Invalid shared start kit');
 return {openEditor:input.openEditor,compose:input.compose,ports:[...new Set(input.ports)]};
}
