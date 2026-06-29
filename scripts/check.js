const fs = require('fs');
for (const file of ['index.html', 'src/main.js', 'src/styles.css', 'README.md']) {
  if (!fs.existsSync(file)) throw new Error(`${file} is missing`);
}
const js = fs.readFileSync('src/main.js', 'utf8');
new Function(js.replace(/^import .*$/gm, ''));
console.log('Static prototype files are present and JavaScript parses.');
