const fs = require('fs');
const path = require('path');
const { build } = require('../src/docs/openapi');
const out = path.join(__dirname, '../docs/api/openapi.json');
fs.writeFileSync(out, `${JSON.stringify(build(), null, 2)}\n`);
console.log(`wrote ${out}`);
