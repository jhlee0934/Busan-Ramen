import { createRestaurantUpdateDraft } from './update-restaurants.mjs'

const result = await createRestaurantUpdateDraft()
console.log(JSON.stringify(result))
