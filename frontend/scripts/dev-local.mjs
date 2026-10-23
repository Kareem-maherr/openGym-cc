// `npm run dev:local`: the whole app on this machine, with a real account instead of guest mode.
//
// `npm run dev` is the frontend alone and proxies /api to 127.0.0.1:3000 (vite.config.js); with
// nothing listening there every call fails with ECONNREFUSED. This starts the API from ../api on
// that port, with password sign-in on (PASSWORD_LOGIN, docs/SELF_HOSTING.md §4: passkeys need
// HTTPS, and a phone on the LAN reaches the dev server over plain http) and its data in ../data,
// then the dev server, and stops both together. Extra arguments go to vite (`-- --host`).
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const api = join(root, 'api')
const win = process.platform === 'win32'
const npm = win ? 'npm.cmd' : 'npm'

const run = (cmd, args, opts) => spawn(cmd, args, { stdio: 'inherit', shell: win, ...opts })

if (!existsSync(join(api, 'node_modules'))) {
  console.log('[dev:local] installing the API dependencies once…')
  const code = await new Promise(res => run(npm, ['install', '--no-audit', '--no-fund'], { cwd: api }).on('exit', res))
  if (code) process.exit(code)
}

const server = run(process.execPath, ['server.js'], {
  cwd: api,
  shell: false,
  env: {
    ...process.env,
    PORT: process.env.PORT || '3000',
    DATA_DIR: process.env.DATA_DIR || join(root, 'data'),
    PASSWORD_LOGIN: process.env.PASSWORD_LOGIN || '1',
  },
})
const vite = run(npm, ['exec', '--', 'vite', ...process.argv.slice(2)], { cwd: join(root, 'frontend') })

const stop = code => { server.kill(); vite.kill(); process.exit(code ?? 0) }
server.on('exit', code => { if (code) console.error(`[dev:local] the API stopped (exit ${code})`); stop(code) })
vite.on('exit', stop)
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
