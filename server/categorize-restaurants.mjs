import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const file = path.join(root, 'data', 'restaurants.json')
const restaurants = JSON.parse(await readFile(file, 'utf8'))
const rules = [
  ['jiro', /지로|스트롱부타|야채많이|세아부라/i],
  ['chintan', /청탕|쇼유|시오|다시소바|중화소바/i],
  ['paitan', /백탕|파이탄|돈코츠|돼지.?육수|돈사골/i],
  ['tsukemen', /츠케멘/i],
  ['abura', /아부라|마제|비빔/i],
]

for (const restaurant of restaurants) {
  const searchable = JSON.stringify({
    styles: restaurant.ramenStyles,
    menus: restaurant.signatureMenus,
    reviews: restaurant.community.reviewItems,
    features: restaurant.features,
    note: restaurant.enthusiastNote,
  })
  const categories = rules.filter(([, pattern]) => pattern.test(searchable)).map(([category]) => category)
  restaurant.ramenCategories = categories.length > 0 ? categories : ['other']
}

await writeFile(file, `${JSON.stringify(restaurants, null, 2)}\n`, 'utf8')
console.log(`Categorized ${restaurants.length} restaurants.`)
