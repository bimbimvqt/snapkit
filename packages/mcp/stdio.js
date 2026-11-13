import {readFile} from 'node:fs/promises';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
export function loopbackEndpoint(value){const url=new URL(value);if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('MCP requires a loopback HTTP origin');return url.origin;}
export async function startMcp(args=process.argv.slice(2)){
 const option=name=>args[args.indexOf(name)+1];
 if(!args.includes('--endpoint')||!args.includes('--key-file'))throw Error('MCP endpoint and key file are required');
 const endpoint=loopbackEndpoint(option('--endpoint')),keyFile=option('--key-file');
 const relay=async(body)=>{const key=(await readFile(keyFile,'utf8')).trim();if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid MCP key file');const response=await fetch(endpoint+'/api/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Snapkit MCP unavailable');return result;};
 const server=new Server({name:'snapkit',version:'1.0.0'},{capabilities:{tools:{}}});
 server.setRequestHandler(ListToolsRequestSchema,()=>relay({action:'list'}));
 server.setRequestHandler(CallToolRequestSchema,async request=>{try{const result=await relay({action:'call',name:request.params.name,arguments:request.params.arguments||{}});return {content:[{type:'text',text:JSON.stringify(result)}]};}catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}});
 await server.connect(new StdioServerTransport());return server;
}
