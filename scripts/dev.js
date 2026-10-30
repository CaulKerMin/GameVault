'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const commands = [
  ['web', path.join(root, 'frontend', 'dev-server.js')],
  ['api', path.join(root, 'backend', 'server.js')],
];
const children = commands.map(([label, script]) => {
  const child = spawn(process.execPath, [script], { cwd: root, env: process.env, stdio: 'inherit' });
  child.on('exit', (code) => {
    if (!stopping && code !== 0) {
      console.error(`${label} process exited with code ${code ?? 'unknown'}`);
      stop();
    }
  });
  return child;
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => { if (!child.killed) child.kill('SIGTERM'); });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
console.log('Press Ctrl+C to stop both services.');
