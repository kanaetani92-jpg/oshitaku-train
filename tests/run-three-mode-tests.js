const { spawnSync } = require('node:child_process');
const path = require('node:path');

const testFiles = [
  'three-mode-time.test.js',
  'three-mode-done-timer.test.js',
  'three-mode-auto-timer.test.js',
  'three-mode-clock-mode.test.js',
  'three-mode-editor.test.js',
  'three-mode-regression.test.js'
];

let failed = false;

for (const filename of testFiles) {
  const fullPath = path.join(__dirname, filename);
  const result = spawnSync(process.execPath, [fullPath], {
    cwd:path.resolve(__dirname, '..'),
    encoding:'utf8'
  });

  process.stdout.write(`\n[${filename}]\n`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`${filename} failed with exit code ${result.status}\n`);
    break;
  }
}

if (failed) process.exit(1);
console.log('\nAll three-mode tests passed');
