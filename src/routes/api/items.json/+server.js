/**
 * Items API endpoint
 * 
 * Fetches items from PokeAPI with local caching for performance.
 * Uses the official PokeAPI v2 endpoints with intelligent caching.
 * 
 * GET /api/items.json
 * 
 * Returns: Array of item objects with id, name, sprite, and effect
 */

// In-memory cache for items
let itemsCache = null
let cacheTimestamp = null
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

/**
 * Fetch items from PokeAPI with caching
 */
async function fetchItemsFromPokeAPI() {
  try {
    console.log('[Items API] Fetching items from PokeAPI...')
    
    // Fetch the items list (first 2000 items should cover all available items)
    const response = await fetch('https://pokeapi.co/api/v2/item?limit=2000')
    
    if (!response.ok) {
      throw new Error(`PokeAPI responded with status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log(`[Items API] Fetched ${data.results.length} items from PokeAPI`)
    
    // Filter out items that are not useful for held items (like key items, TMs, etc.)
    // We'll focus on items that can actually be held by Pokémon
    const usefulItems = data.results.filter(item => {
      const name = item.name.toLowerCase()
      
      // Exclude key items, TMs, HMs, and other non-holdable items
      const excludePatterns = [
        'tm', 'hm', 'key', 'bike', 'map', 'card', 'pass', 'ticket', 'badge',
        'machine', 'part', 'fossil', 'gem', 'shard', 'piece', 'fragment',
        'letter', 'mail', 'envelope', 'parcel', 'package', 'box', 'case',
        'rod', 'net', 'ball', 'potion', 'medicine', 'revive', 'repel',
        'incense', 'incubator', 'bike', 'skateboard', 'scooter'
      ]
      
      return !excludePatterns.some(pattern => name.includes(pattern))
    })
    
    console.log(`[Items API] Filtered to ${usefulItems.length} useful items`)
    
    // Format items for our application with real effects
    const formattedItems = await Promise.all(
      usefulItems.map(async (item, index) => {
        try {
          // Fetch detailed item data to get the actual effect
          const itemResponse = await fetch(item.url)
          if (!itemResponse.ok) {
            throw new Error(`Failed to fetch item details for ${item.name}`)
          }
          
          const itemData = await itemResponse.json()
          
          // Extract the effect from the item data
          let effect = 'No effect description available'
          
          // Try to get effect from effect_entries (English)
          if (itemData.effect_entries && itemData.effect_entries.length > 0) {
            const englishEffect = itemData.effect_entries.find(entry => entry.language.name === 'en')
            if (englishEffect) {
              effect = englishEffect.effect || englishEffect.short_effect || effect
            }
          }
          
          // Fallback to flavor_text_entries if no effect_entries
          if (effect === 'No effect description available' && itemData.flavor_text_entries && itemData.flavor_text_entries.length > 0) {
            const englishFlavor = itemData.flavor_text_entries.find(entry => entry.language.name === 'en')
            if (englishFlavor) {
              effect = englishFlavor.text
            }
          }
          
          return {
            id: index + 1,
            name: item.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            sprite: item.name,
            effect: effect
          }
        } catch (error) {
          console.warn(`[Items API] Failed to fetch details for ${item.name}:`, error.message)
          // Return item with fallback effect
          return {
            id: index + 1,
            name: item.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            sprite: item.name,
            effect: 'Effect details not available'
          }
        }
      })
    )
    
    return formattedItems
    
  } catch (error) {
    console.error('[Items API] Error fetching from PokeAPI:', error)
    throw error
  }
}

/**
 * Get cached items or fetch from PokeAPI
 */
async function getItems() {
  const now = Date.now()
  
  // Check if cache is valid
  if (itemsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('[Items API] Returning cached items')
    return itemsCache
  }
  
  // Fetch fresh data
  itemsCache = await fetchItemsFromPokeAPI()
  cacheTimestamp = now
  
  return itemsCache
}

export async function GET() {
  try {
    const items = await getItems()
    
    console.log(`[Items API] Returning ${items.length} items`)
    
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'X-Data-Source': 'PokeAPI'
      }
    })
    
  } catch (error) {
    console.error('[Items API] Error:', error)
    
    // Fallback to a minimal curated list if PokeAPI fails
    const fallbackItems = [
      { id: 1, name: 'Oran Berry', sprite: 'oran-berry', effect: 'Restores 10 HP when HP is below 50%' },
      { id: 2, name: 'Sitrus Berry', sprite: 'sitrus-berry', effect: 'Restores 25% of max HP when HP is below 50%' },
      { id: 3, name: 'Lum Berry', sprite: 'lum-berry', effect: 'Cures any status condition when HP is below 50%' },
      { id: 4, name: 'Leftovers', sprite: 'leftovers', effect: 'Restores 1/16 of max HP each turn' },
      { id: 5, name: 'Life Orb', sprite: 'life-orb', effect: 'Boosts damage by 30% but loses 10% HP per attack' },
      { id: 6, name: 'Choice Band', sprite: 'choice-band', effect: 'Boosts Attack by 50% but locks into one move' },
      { id: 7, name: 'Focus Sash', sprite: 'focus-sash', effect: 'Survives one hit that would KO from full HP' },
      { id: 8, name: 'Expert Belt', sprite: 'expert-belt', effect: 'Boosts super-effective moves by 20%' }
    ]
    
    console.log('[Items API] Using fallback items due to error')
    
    return new Response(JSON.stringify(fallbackItems), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Short cache for fallback
        'X-Data-Source': 'Fallback'
      }
    })
  }
}
