import restaurantData from '../../../data/restaurants.json'
import { RestaurantCollectionSchema } from './schema'
import type { RestaurantLoadResult } from './types'

function formatIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.length === 0 ? 'dataset' : issue.path.join('.')
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

export function loadRestaurants(input: unknown = restaurantData): RestaurantLoadResult {
  const result = RestaurantCollectionSchema.safeParse(input)

  if (!result.success) {
    return {
      status: 'error',
      message: formatIssues(result.error.issues),
    }
  }

  return { status: 'ready', restaurants: result.data }
}

export function loadPublishedRestaurants(input: unknown = restaurantData): RestaurantLoadResult {
  const result = loadRestaurants(input)
  if (result.status === 'error') return result
  return {
    status: 'ready',
    restaurants: result.restaurants.filter((restaurant) => restaurant.verificationStatus === 'verified'),
  }
}
