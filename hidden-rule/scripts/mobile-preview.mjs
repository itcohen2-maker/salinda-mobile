import { spawn } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import process from 'node:process'

import QRCode from 'qrcode'

const port = process.env.MOBILE_PREVIEW_PORT ?? '4174'
const qrFile = path.join(process.cwd(), 'mobile-web-qr.png')

function getLanIp() {
  const nets = networkInterfaces()
  const preferred = ['wi-fi', 'wireless', 'wlan', 'eth', 'en']
  const candidates = []

  for (const [name, entries] of Object.entries(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      candidates.push({ address: entry.address, name: name.toLowerCase() })
    }
  }

  for (const key of preferred) {
    const match = candidates.find((candidate) => candidate.name.includes(key))
    if (match) return match.address
  }

  return candidates[0]?.address ?? '127.0.0.1'
}

function runStep(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: true,
      stdio: 'inherit',
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
    })
  })
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const lanIp = getLanIp()
const url = `http://${lanIp}:${port}/`

await runStep(npmCommand, ['run', 'build'])
await QRCode.toFile(qrFile, url, { margin: 2, width: 360 })

console.log('')
console.log(`Mobile preview URL: ${url}`)
console.log(`QR saved to: ${qrFile}`)
console.log('Leave this process running while testing on the phone.')
console.log('')

const preview = spawn(
  npmCommand,
  ['run', 'preview', '--', '--host', '0.0.0.0', '--port', String(port)],
  {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
  },
)

preview.on('exit', (code) => {
  process.exit(code ?? 0)
})
