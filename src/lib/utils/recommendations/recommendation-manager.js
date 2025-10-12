/**
 * Recommendation Manager
 * 
 * Shared logic for managing recommendation methods and API calls
 * across different components (ProgressModal, RouteRecommendations, etc.)
 * 
 * This module eliminates code duplication and provides a consistent
 * interface for recommendation functionality.
 */

import { 
  formatCapturedPokemonForAPI, 
  formatRoutePokemonForAPI, 
  formatRivalPokemonForAPI,
  formatBossTeamForAPI,
  calculateLevelCap,
  validatePokemonForAdvancedRecommendations,
  createMissingDataErrorMessage
} from './pokemon-data-processor.js'

/**
 * Recommendation method constants
 */
export const RECOMMENDATION_METHODS = {
  BASIC: 'basic',
  ADVANCED: 'advanced'
}

/**
 * Default recommendation settings
 */
export const DEFAULT_SETTINGS = {
  METHOD: RECOMMENDATION_METHODS.BASIC,
  SETTING_INDEX: 0 // 0 = Basic, 1 = Advanced
}

/**
 * Recommendation Manager Class
 * 
 * Handles recommendation method selection, data validation,
 * and API calls for both captured and route Pokémon recommendations.
 */
export class RecommendationManager {
  constructor() {
    this.method = RECOMMENDATION_METHODS.BASIC
    this.defaultSetting = DEFAULT_SETTINGS.SETTING_INDEX
    this.loadingAdvanced = false
    this.advancedRecommendations = []
    this.isAdvancedModalOpen = false
    this.selectedAdvancedPokemon = null
  }

  /**
   * Update recommendation method from game settings
   * 
   * @param {Object} settings - Game settings object
   * @param {Function} getSetting - Function to get setting index
   */
  updateMethodFromSettings(settings, getSetting) {
    const settingValue = (settings || '011101000')[getSetting('recommendation-method')]
    this.defaultSetting = parseInt(settingValue) || DEFAULT_SETTINGS.SETTING_INDEX
    this.method = this.defaultSetting === 1 ? RECOMMENDATION_METHODS.ADVANCED : RECOMMENDATION_METHODS.BASIC
  }

  /**
   * Toggle between basic and advanced recommendation methods
   */
  toggleMethod() {
    this.method = this.method === RECOMMENDATION_METHODS.BASIC 
      ? RECOMMENDATION_METHODS.ADVANCED 
      : RECOMMENDATION_METHODS.BASIC
  }

  /**
   * Get current recommendation method
   * 
   * @returns {string} Current method ('basic' or 'advanced')
   */
  getCurrentMethod() {
    return this.method
  }

  /**
   * Check if using advanced recommendations
   * 
   * @returns {boolean} True if using advanced method
   */
  isAdvanced() {
    return this.method === RECOMMENDATION_METHODS.ADVANCED
  }

  /**
   * Check if using basic recommendations
   * 
   * @returns {boolean} True if using basic method
   */
  isBasic() {
    return this.method === RECOMMENDATION_METHODS.BASIC
  }

  /**
   * Load advanced recommendations for captured Pokémon (boss battle context)
   * 
   * @param {Array} capturedPokemon - User's captured Pokémon
   * @param {Array} rivalPokemon - Rival's Pokémon (boss team)
   * @param {string} gameKey - Game identifier
   * @returns {Promise<Array>} Advanced recommendations result
   */
  async loadAdvancedRecommendationsForCaptured(capturedPokemon, rivalPokemon, gameKey) {
    console.log('[RecommendationManager] Loading advanced recommendations for captured Pokémon...')
    
    // Calculate level cap from rival Pokémon
    const levelCap = calculateLevelCap(rivalPokemon)
    console.log(`[RecommendationManager] Level cap: ${levelCap}`)

    // Format user Pokémon (captured) with level cap applied and auto-evolution
    const userPokemon = formatCapturedPokemonForAPI(capturedPokemon, levelCap, gameKey)
    
    // Validate user Pokémon data
    const validation = validatePokemonForAdvancedRecommendations(userPokemon)
    if (!validation.isValid) {
      const errorMessage = createMissingDataErrorMessage(validation.missingData)
      throw new Error(errorMessage)
    }

    // Format rival Pokémon
    const formattedRivalPokemon = formatRivalPokemonForAPI(rivalPokemon)

    // Make API request
    return await this._callAdvancedAPI(userPokemon, formattedRivalPokemon, gameKey, 'boss')
  }

  /**
   * Load advanced recommendations for route Pokémon
   * 
   * @param {Array} routePokemon - Route encounter Pokémon
   * @param {Array} bossTeam - Boss team data
   * @param {string} gameKey - Game identifier
   * @returns {Promise<Array>} Advanced recommendations result
   */
  async loadAdvancedRecommendationsForRoute(routePokemon, bossTeam, gameKey) {
    console.log('[RecommendationManager] Loading advanced recommendations for route Pokémon...')
    console.log('[RecommendationManager] Boss team structure:', bossTeam.map(p => ({
      name: p.name,
      alias: p.alias,
      hasOriginal: !!p.original,
      originalKeys: p.original ? Object.keys(p.original) : []
    })))
    
    // Calculate level cap from boss team
    const levelCap = calculateLevelCap(bossTeam)
    console.log(`[RecommendationManager] Level cap: ${levelCap}`)

    // Format user Pokémon (route encounters) with level cap applied and auto-evolution
    const userPokemon = formatRoutePokemonForAPI(routePokemon, levelCap, gameKey)
    
    // Format rival Pokémon from boss team
    const rivalPokemon = formatBossTeamForAPI(bossTeam)
    console.log('[RecommendationManager] Formatted rival Pokémon:', rivalPokemon.map(p => ({
      name: p.name,
      level: p.level,
      ability: p.ability,
      moves: p.moves,
      item: p.item,
      stats: p.stats // ← Ver qué stats se están enviando
    })))

    // Make API request
    return await this._callAdvancedAPI(userPokemon, rivalPokemon, gameKey, 'route')
  }

  /**
   * Call the advanced recommendations API
   * 
   * @private
   * @param {Array} userPokemon - Formatted user Pokémon data
   * @param {Array} rivalPokemon - Formatted rival Pokémon data
   * @param {string} gameKey - Game identifier
   * @param {string} gameMode - Game mode ('boss' or 'route')
   * @returns {Promise<Array>} API response
   */
  async _callAdvancedAPI(userPokemon, rivalPokemon, gameKey, gameMode) {
    this.loadingAdvanced = true
    
    try {
      const requestBody = {
        userPokemon,
        rivalPokemon,
        game: gameKey,
        gameMode
      }
      
      console.log('[RecommendationManager] API request body:', requestBody)
      
      const response = await fetch('/api/recommendations/advanced.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log('[RecommendationManager] API response:', result)
      
      // Extract recommendations array from API response
      const recommendations = result.recommendations || result
      this.advancedRecommendations = recommendations
      return recommendations
      
    } catch (error) {
      console.error('[RecommendationManager] API error:', error)
      throw error
    } finally {
      this.loadingAdvanced = false
    }
  }

  /**
   * Show advanced recommendation details modal
   * 
   * @param {Object} pokemon - Selected Pokémon for detailed view
   */
  showAdvancedModal(pokemon) {
    this.selectedAdvancedPokemon = pokemon
    this.isAdvancedModalOpen = true
  }

  /**
   * Hide advanced recommendation details modal
   */
  hideAdvancedModal() {
    this.isAdvancedModalOpen = false
    this.selectedAdvancedPokemon = null
  }

  /**
   * Get loading state for advanced recommendations
   * 
   * @returns {boolean} True if loading
   */
  isLoadingAdvanced() {
    return this.loadingAdvanced
  }

  /**
   * Get advanced recommendations result
   * 
   * @returns {Array} Advanced recommendations
   */
  getAdvancedRecommendations() {
    return this.advancedRecommendations
  }

  /**
   * Get advanced modal state
   * 
   * @returns {Object} Modal state
   */
  getAdvancedModalState() {
    return {
      show: this.isAdvancedModalOpen,
      selectedPokemon: this.selectedAdvancedPokemon
    }
  }

  /**
   * Reset manager state
   */
  reset() {
    this.method = RECOMMENDATION_METHODS.BASIC
    this.defaultSetting = DEFAULT_SETTINGS.SETTING_INDEX
    this.loadingAdvanced = false
    this.advancedRecommendations = []
    this.isAdvancedModalOpen = false
    this.selectedAdvancedPokemon = null
  }
}

/**
 * Create a new recommendation manager instance
 * 
 * @returns {RecommendationManager} New manager instance
 */
export function createRecommendationManager() {
  return new RecommendationManager()
}
