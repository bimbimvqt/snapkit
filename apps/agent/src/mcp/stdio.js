import {startMcp} from '../../../../packages/mcp/stdio.js';
startMcp().catch(error=>{console.error(error.message);process.exitCode=1;});
