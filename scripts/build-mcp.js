import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
await build({entryPoints:[path.join(root,'apps/agent/src/mcp/stdio.js')],outfile:path.join(root,'apps/desktop/build/mcp.cjs'),bundle:true,platform:'node',format:'cjs',target:'node22',logLevel:'warning'});
