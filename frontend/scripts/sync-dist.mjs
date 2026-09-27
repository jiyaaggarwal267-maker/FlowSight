// Mirrors the Vite build into backend/frontend/dist, which is the directory
// FastAPI Cloud actually serves.
//
// Only the `backend/` app directory is mounted on FastAPI Cloud, so a build
// left in frontend/dist is never deployed. Copying manually is easy to forget,
// which silently ships a stale UI, so this runs automatically after every
// `npm run build` and clears the old hashed assets to avoid unbounded growth.
import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, "../dist")
const target = resolve(here, "../../backend/frontend/dist")

// A localhost API address baked into the bundle makes every visitor's browser
// call its own machine instead of the deployed API, which looks exactly like a
// broken backend. Vite inlines VITE_* at build time, so catch it here rather
// than discovering it in the browser console.
//
// The port is required so we do not trip over libraries that legitimately ship
// a bare "http://localhost" as a base URL for resolving relative links.
const LOCAL_API_URL = /(?:https?:)?\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+/i
const offenders = []
for (const file of await readdir(resolve(source, "assets"))) {
  if (!/\.(js|css|html)$/.test(file)) continue
  const text = await readFile(resolve(source, "assets", file), "utf8")
  if (LOCAL_API_URL.test(text)) offenders.push(file)
}
if (offenders.length > 0) {
  console.error(
    `\n✗ Refusing to sync: localhost reference found in built assets:\n  ${offenders.join("\n  ")}\n` +
      "  A production bundle must call its own origin. Check for a VITE_API_URL\n" +
      "  pointing at localhost in a .env file loaded during `vite build`.\n",
  )
  process.exit(1)
}

await rm(target, { recursive: true, force: true })
await mkdir(dirname(target), { recursive: true })
await cp(source, target, { recursive: true })

const copied = await readdir(resolve(target, "assets"))
console.log(`synced build -> backend/frontend/dist (${copied.length} assets)`)
