// Local verification of project Pages URLs, including the /snapkit/ base path.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { websiteNotFound } from '../packages/web/not-found.js';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app = express();
app.get(['/snapkit/404.html', '/snapkit/en/404.html'], (req, res, next) => { req.url = req.url.replace(/^\/snapkit/, ''); websiteNotFound({ base: '/snapkit/' })(req, res, next); });
app.use('/snapkit', express.static(path.join(root, 'dist')));
app.use('/snapkit', websiteNotFound({ base: '/snapkit/' }));
app.listen(Number(process.env.PORT || 14321), '127.0.0.1');
