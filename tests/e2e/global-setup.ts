import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export default async function globalSetup() {
  const viteCli = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url))
  const server = spawn(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', '8798'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    stdio: 'ignore',
  })
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:8798/')
      if (response.ok) return () => { server.kill() }
    } catch {
      // The preview process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  server.kill()
  throw new Error('Vite preview server did not start')
}
