'use strict';
// Electron's regular fs treats app.asar as a virtual directory. Updaters must
// copy/delete downloaded bundles as real files, including their ASAR archives.
let filesystem;
try { filesystem = require('original-fs'); } catch { filesystem = require('node:fs'); }
module.exports = filesystem;
