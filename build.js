// Copies the engine files (strive-*.css / strive-*.js) into ./dist for `wrangler deploy`.
const fs = require('fs'), path = require('path');
const out = path.join(__dirname, 'dist');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
for (const f of fs.readdirSync(__dirname)) if (/^strive-.*\.(css|js)$/.test(f)) fs.copyFileSync(path.join(__dirname, f), path.join(out, f));
console.log('dist:', fs.readdirSync(out).length, 'files');
