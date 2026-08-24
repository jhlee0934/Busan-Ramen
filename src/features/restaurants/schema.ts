import { z } from 'zod'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const httpsUrlSchema = z.string().regex(/^https:\/\//, 'Expected an HTTPS URL')

const nullableTextSchema = z.string().trim().min(1).nullable()

export const MenuSchema = z.object({
  name: z.string().trim().min(1),
  price: z.number().int().positive(),
  description: z.string().trim().min(1),
})

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const MapLinksSchema = z.object({
  naver: httpsUrlSchema.nullable(),
  kakao: httpsUrlSchema.nullable(),
})

export const SourceSchema = z.object({
  title: z.string().trim().min(1),
  url: httpsUrlSchema,
  publishedOrCheckedAt: isoDateSchema,
  supports: z.string().trim().min(1),
})

export const RamenCategorySchema = z.enum(['chintan', 'paitan', 'jiro', 'tsukemen', 'abura', 'other'])

export const RestaurantSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a slug id'),
    name: z.string().trim().min(1),
    branch: nullableTextSchema,
    area: z.string().trim().min(1),
    address: z.string().trim().min(1),
    verificationStatus: z.enum(['verified', 'candidate']).default('verified'),
    locationPrecision: z.enum(['exact', 'area']).default('exact'),
    nearestStation: nullableTextSchema,
    coordinates: CoordinatesSchema.nullable(),
    ramenStyles: z.array(z.string().trim().min(1)),
    ramenCategories: z.array(RamenCategorySchema).min(1),
    signatureMenus: z.array(MenuSchema),
    features: z.object({
      broth: nullableTextSchema,
      noodles: nullableTextSchema,
      tare: nullableTextSchema,
      toppings: nullableTextSchema,
    }),
    enthusiastNote: z.string().trim().min(1),
    cautions: z.array(z.string().trim().min(1)),
    hours: nullableTextSchema,
    closedDays: nullableTextSchema,
    breakTime: nullableTextSchema,
    waitingInfo: nullableTextSchema,
    lastVerified: isoDateSchema,
    mapLinks: MapLinksSchema,
    community: z.object({
      summary: z.string().trim().min(1),
      reviewItems: z.array(z.object({
        menu: z.string().trim().min(1),
        summary: z.string().trim().min(1),
        evidencePostIds: z.array(z.number().int().positive()).default([]),
      })).max(3).default([]),
      generatedBy: z.enum(['openai', 'rating-fallback']),
      updatedAt: isoDateSchema,
      evidencePostIds: z.array(z.number().int().positive()).min(2),
    }),
    sources: z.array(SourceSchema).min(2, 'At least two sources are required'),
  })
  .superRefine((restaurant, context) => {
    const ids = new Set(restaurant.ramenStyles.map((style) => style.toLowerCase()))

    if (ids.size !== restaurant.ramenStyles.length) {
      context.addIssue({
        code: 'custom',
        path: ['ramenStyles'],
        message: 'Ramen styles must not contain duplicates',
      })
    }
  })

export const RestaurantCollectionSchema = z.array(RestaurantSchema)
