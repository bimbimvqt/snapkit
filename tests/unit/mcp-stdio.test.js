import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';
import express from 'express';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {McpAccess} from '../../apps/agent/src/modules/dev-lab/mcp.js';
import {loopbackEndpoint} from '../../packages/mcp/stdio.js';
test('SDK stdio initializes, lists read tools, calls API and observes live access revocation',async t=>{
 const store=await mkdtemp(path.join(os.tmpdir(),'snapkit-mcp-sdk-'));const access=new McpAccess({store,lab:{status:()=>({jobs:[]})},context:()=>({workspace:'/test/project',devices:[]}),logs:()=>[],port:1});await access.update({enabled:true});
 const app=express();app.use(express.json());app.post('/api/mcp',async(req,res)=>{if(!access.authorize(req))return res.status(403).json({error:'Authentication failed'});try{res.json(await access.dispatch(req.body));}catch(e){res.status(400).json({error:e.message});}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../../apps/agent/src/mcp/stdio.js',import.meta.url)),'--endpoint',origin,'--key-file',access.keyFile],stderr:'pipe'});const client=new Client({name:'snapkit-test-client',version:'1.0.0'});
 t.after(async()=>{await client.close();await new Promise(resolve=>server.close(resolve));await rm(store,{recursive:true,force:true});});
 await client.connect(transport);const tools=await client.listTools();assert.equal(tools.tools.length,4);assert.ok(!tools.tools.some(t=>t.name==='snapkit_test'));
 const result=await client.callTool({name:'snapkit_context',arguments:{}});assert.equal(JSON.parse(result.content[0].text).workspace,'/test/project');
 await access.update({allowActions:true,rotate:true});assert.equal((await client.listTools()).tools.length,6);
 await access.update({enabled:false});const denied=await client.callTool({name:'snapkit_context',arguments:{}});assert.equal(denied.isError,true);
});
test('MCP relay refuses network hosts, credentials, queries and extra paths',()=>{assert.equal(loopbackEndpoint('http://localhost:4310'),'http://localhost:4310');for(const url of ['https://127.0.0.1:4310','http://example.com','http://user:pass@127.0.0.1:4310','http://127.0.0.1:4310/path','http://127.0.0.1:4310/?token=abc'])assert.throws(()=>loopbackEndpoint(url));});
