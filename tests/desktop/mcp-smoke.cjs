'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
(async()=>{
 const {Client}=await import('@modelcontextprotocol/sdk/client/index.js');const {StdioClientTransport}=await import('@modelcontextprotocol/sdk/client/stdio.js');const {default:express}=await import('express');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'snapkit-mcp-desktop-')),key='a'.repeat(64);const keyFile=path.join(root,'mcp.key');await fs.writeFile(keyFile,key,{mode:0o600});
 const api=express();api.use(express.json());api.post('/api/mcp',(req,res)=>{if(req.headers.authorization!=='Bearer '+key)return res.sendStatus(403);if(req.body.action==='list')return res.json({tools:[{name:'desktop_smoke',description:'Smoke test',inputSchema:{type:'object',properties:{}}}]});res.json({connected:true});});
 const server=api.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const client=new Client({name:'desktop-smoke',version:'1'});const transport=new StdioClientTransport({command:require('electron'),args:[path.resolve(__dirname,'../..'),'--snapkit-mcp','--endpoint','http://127.0.0.1:'+server.address().port,'--key-file',keyFile],env,stderr:'pipe'});
 const timer=setTimeout(()=>{console.error('Desktop MCP timed out');void client.close();process.exitCode=1;},20000);
 try{await client.connect(transport);assert.equal((await client.listTools()).tools[0].name,'desktop_smoke');const result=await client.callTool({name:'desktop_smoke',arguments:{}});assert.equal(JSON.parse(result.content[0].text).connected,true);console.log('PASS: desktop MCP mode connects over stdio without launching another agent');}
 finally{clearTimeout(timer);await client.close();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
