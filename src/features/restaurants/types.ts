import type { z } from 'zod'
import type {
  CoordinatesSchema,
  MapLinksSchema,
  MenuSchema,
  RestaurantCollectionSchema,
  RestaurantSchema,
  RamenCategorySchema,
  SourceSchema,
} from './schema'

export type Menu = z.infer<typeof MenuSchema>
export type Coordinates = z.infer<typeof CoordinatesSchema>
export type MapLinks = z.infer<typeof MapLinksSchema>
export type RestaurantSource = z.infer<typeof SourceSchema>
export type Restaurant = z.infer<typeof RestaurantSchema>
export type RamenCategory = z.infer<typeof RamenCategorySchema>
export type RestaurantCollection = z.infer<typeof RestaurantCollectionSchema>

export type RestaurantLoadResult =
  | { status: 'ready'; restaurants: RestaurantCollection }
  | { status: 'error'; message: string }
