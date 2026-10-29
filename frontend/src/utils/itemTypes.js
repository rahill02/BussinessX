// stored values stay normal/shoes/loose; only the words shown to shopkeepers change
export const ITEM_TYPES = [
  { key: 'normal', label: 'Pieces', hint: 'Packs, bottles', icon: 'tag' },
  { key: 'shoes', label: 'Sizes', hint: 'Shoes, clothes', icon: 'shirt' },
  { key: 'loose', label: 'Weight', hint: 'kg, g, litre', icon: 'scale' },
]

export function typeLabel(key) {
  return ITEM_TYPES.find((t) => t.key === key)?.label || key
}
