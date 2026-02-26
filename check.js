const fs = require('fs');
const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const idsInApp = [...app.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
const missing = idsInApp.filter(id => !html.includes('id="' + id + '"') && !html.includes("id='" + id + "'"));
console.log('Missing IDs:', Array.from(new Set(missing)));
