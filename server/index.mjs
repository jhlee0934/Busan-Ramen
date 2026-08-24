import { createApp } from './app.mjs'
import { config } from './config.mjs'
import { createRestaurantUpdateDraft, shouldRunUpdate } from './update-restaurants.mjs'

const app = createApp()

async function runScheduledUpdate() {
  if (!config.updateEnabled || !(await shouldRunUpdate())) return
  try {
    await createRestaurantUpdateDraft()
  } catch (error) {
    console.error('Scheduled restaurant update failed:', error instanceof Error ? error.message : 'unknown error')
  }
}

setInterval(runScheduledUpdate, 60 * 60 * 1000).unref()
void runScheduledUpdate()

app.listen(config.port, () => {
  console.log(`Busan Ramen Guide server listening on http://127.0.0.1:${config.port}`)
})
