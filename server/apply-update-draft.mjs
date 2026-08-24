import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dataDirectory = path.join(root, 'data')
const stateFile = path.join(dataDirectory, 'update-state.json')
const restaurantsFile = path.join(dataDirectory, 'restaurants.json')

const state = JSON.parse(await readFile(stateFile, 'utf8'))
const requestedDraft = process.argv[2] ?? state.draftFile
if (!requestedDraft) throw new Error('No pending update draft was selected')

const draftFile = path.resolve(root, requestedDraft)
const updatesDirectory = path.resolve(dataDirectory, 'updates')
if (path.dirname(draftFile) !== updatesDirectory || !path.basename(draftFile).startsWith('pending-')) {
  throw new Error('Only a pending draft in data/updates can be applied')
}

const document = JSON.parse(await readFile(draftFile, 'utf8'))
const proposedRestaurants = document?.draft?.proposedRestaurants
if (!Array.isArray(proposedRestaurants) || proposedRestaurants.length === 0) {
  throw new Error('The selected draft has no proposed restaurants')
}

const currentRestaurants = JSON.parse(await readFile(restaurantsFile, 'utf8'))
if (proposedRestaurants.length !== currentRestaurants.length) {
  throw new Error(`Restaurant count mismatch: current=${currentRestaurants.length}, proposed=${proposedRestaurants.length}`)
}
const currentIds = new Set(currentRestaurants.map((restaurant) => restaurant.id))
if (new Set(proposedRestaurants.map((restaurant) => restaurant.id)).size !== currentIds.size
  || proposedRestaurants.some((restaurant) => !currentIds.has(restaurant.id))) {
  throw new Error('The selected draft does not contain the same restaurant IDs as the published data')
}

const currentById = new Map(currentRestaurants.map((restaurant) => [restaurant.id, restaurant]))
for (const restaurant of proposedRestaurants) {
  const generatedIds = restaurant.community?.evidencePostIds ?? []
  if (generatedIds.length >= 2) continue
  restaurant.community.evidencePostIds = [...new Set([
    ...generatedIds,
    ...(currentById.get(restaurant.id)?.community?.evidencePostIds ?? []),
  ])]
}

await mkdir(updatesDirectory, { recursive: true })
const approvedAt = new Date().toISOString()
const backupFile = path.join(updatesDirectory, `pre-apply-${approvedAt.replaceAll(':', '-')}.json`)
await writeFile(backupFile, `${JSON.stringify(currentRestaurants, null, 2)}\n`, 'utf8')
await writeFile(restaurantsFile, `${JSON.stringify(proposedRestaurants, null, 2)}\n`, 'utf8')
await writeFile(stateFile, `${JSON.stringify({
  ...state,
  lastApprovedAt: approvedAt,
  approvedDraftFile: path.relative(root, draftFile),
  preApplyBackupFile: path.relative(root, backupFile),
}, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({ approvedAt, draftFile: path.relative(root, draftFile), backupFile: path.relative(root, backupFile), restaurantCount: proposedRestaurants.length }))
