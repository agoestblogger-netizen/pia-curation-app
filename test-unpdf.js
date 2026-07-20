const { extractText } = require('unpdf');
const fs = require('fs');

async function test() {
  const buf = new Uint8Array(fs.readFileSync('package.json')); // just pass some garbage and see if it fails early or wait, it expects a valid PDF to extract text.
}
