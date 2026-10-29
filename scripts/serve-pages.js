// Local verification of project Pages URLs, including the /snapkit/ base path.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app = express();
app.use('/snapkit', express.static(path.join(root, 'dist')));
app.listen(Number(process.env.PORT || 14321), '127.0.0.1');
