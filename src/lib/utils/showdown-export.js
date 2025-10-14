import { capitalise } from './string.js'

/**
 * Generate Showdown format for a Pokémon team
 * @param {Array} team - Array of Pokémon objects with original data
 * @param {number} [customLevel] - Optional custom level for all Pokémon (default: use individual levels or 50)
 * @returns {string} Team in Showdown format
 */
export function generateShowdownFormat(team, customLevel = null) {
  if (!team || team.length === 0) {
    return 'No team data available';
  }

  const showdownTeam = team.map((pokemon) => {
    // Try to get data from pokemon.original first, otherwise use pokemon directly
    const pokemonData = pokemon.original || pokemon;
    
    if (!pokemonData || !pokemonData.pokemon) {
      return '';
    }

    const name = capitalise(pokemonData.pokemon || pokemon.name || 'Unknown');
    const item = pokemonData.item ? ` @ ${capitalise(pokemonData.item.replace(/-/g, ' '))}` : '';
    const ability = pokemonData.ability ? `\nAbility: ${capitalise(pokemonData.ability.replace(/-/g, ' '))}` : '';
    
    // Use custom level if provided, otherwise use pokemon's level or default to 50
    const level = customLevel !== null 
      ? `\nLevel: ${customLevel}` 
      : (pokemonData.level ? `\nLevel: ${pokemonData.level}` : '\nLevel: 50');
    
    const nature = pokemonData.nature ? `\n${capitalise(pokemonData.nature)} Nature` : '';
    
    const moves = pokemonData.moves && pokemonData.moves.length > 0 
      ? pokemonData.moves.map(move => {
          // Handle if move is a string or an object
          const moveName = typeof move === 'string' ? move : (move?.name || move?.id || 'Unknown Move');
          return `- ${capitalise(moveName.replace(/-/g, ' '))}`;
        }).join('\n')
      : '- (No moves)';

    return `${name}${item}${ability}${level}${nature}\n${moves}`;
  }).filter(pokemon => pokemon !== '').join('\n\n');

  return showdownTeam || 'No valid team data found';
}

/**
 * Export team to Showdown format as downloadable file
 * @param {Array} team - Array of Pokémon objects
 * @param {string} filename - Optional custom filename (default: nuzlocke-team-YYYY-MM-DD.txt)
 * @param {number} [customLevel] - Optional custom level for all Pokémon
 */
export function exportToShowdown(team, filename = null, customLevel = null) {
  const showdownFormat = generateShowdownFormat(team, customLevel);
  
  // Create a blob and download it
  const blob = new Blob([showdownFormat], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `nuzlocke-team-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy team to clipboard in Showdown format
 * @param {Array} team - Array of Pokémon objects
 * @param {number} [customLevel] - Optional custom level for all Pokémon
 * @returns {Promise<boolean>} Success status
 */
export async function copyShowdownToClipboard(team, customLevel = null) {
  try {
    const showdownFormat = generateShowdownFormat(team, customLevel);
    await navigator.clipboard.writeText(showdownFormat);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
