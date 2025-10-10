/**
 * Utility functions for transforming move names to complete move objects
 */

/**
 * Transform move names to complete move objects
 * @param {string[]} moveNames - Array of move names
 * @returns {Promise<Array>} Array of complete move objects
 */
export async function transformMoves(moveNames) {
  if (!moveNames || moveNames.length === 0) {
    return [];
  }

  try {
    // Fetch move data for all moves in parallel
    const movePromises = moveNames.map(async (moveName) => {
      try {
        const response = await fetch(`/api/move/${encodeURIComponent(moveName)}.json`);
        if (response.ok) {
          return await response.json();
        } else {
          console.warn(`Failed to fetch move data for ${moveName}`);
          return createFallbackMove(moveName);
        }
      } catch (error) {
        console.warn(`Error fetching move data for ${moveName}:`, error);
        return createFallbackMove(moveName);
      }
    });

    const moves = await Promise.all(movePromises);
    
    // Filter out null/undefined moves and return valid ones
    return moves.filter(move => move && move.name);
  } catch (error) {
    console.error('Error transforming moves:', error);
    return moveNames.map(createFallbackMove);
  }
}

/**
 * Create a fallback move object when data can't be fetched
 * @param {string} moveName - The move name
 * @returns {object} Fallback move object
 */
function createFallbackMove(moveName) {
  return {
    name: moveName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
    type: 'normal',
    power: null,
    accuracy: null,
    pp: null,
    damage_class: 'status',
    priority: 0,
    effect: ''
  };
}

/**
 * Transform a single move name to complete move object
 * @param {string} moveName - The move name
 * @returns {Promise<object>} Complete move object
 */
export async function transformMove(moveName) {
  const moves = await transformMoves([moveName]);
  return moves[0] || createFallbackMove(moveName);
}
