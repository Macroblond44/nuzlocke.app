/**
 * Icon Verification Utility
 * 
 * This utility helps verify if an icon exists in the IconSet before using it.
 * Use this to avoid runtime errors when importing non-existent icons.
 */

import * as icons from '$lib/components/icons/IconSet.js'

/**
 * Check if an icon exists in the IconSet
 * @param {string} iconName - Name of the icon to check
 * @returns {boolean} - True if icon exists, false otherwise
 */
export function iconExists(iconName) {
  return iconName in icons
}

/**
 * Get all available icon names from IconSet
 * @returns {string[]} - Array of available icon names
 */
export function getAvailableIcons() {
  return Object.keys(icons).filter(key => key !== 'Icon')
}

/**
 * Find icons by partial name match
 * @param {string} partialName - Partial name to search for
 * @returns {string[]} - Array of matching icon names
 */
export function findIcons(partialName) {
  const available = getAvailableIcons()
  return available.filter(iconName => 
    iconName.toLowerCase().includes(partialName.toLowerCase())
  )
}

/**
 * Verify and suggest alternatives for a missing icon
 * @param {string} iconName - Name of the icon to verify
 * @param {string} context - Context for suggesting alternatives (e.g., 'filter', 'sort')
 * @returns {Object} - Verification result with suggestions
 */
export function verifyIconWithSuggestions(iconName, context = '') {
  const exists = iconExists(iconName)
  
  if (exists) {
    return {
      exists: true,
      icon: iconName,
      suggestions: []
    }
  }
  
  // Find similar icons
  const suggestions = findIcons(context || iconName)
  
  return {
    exists: false,
    icon: iconName,
    suggestions: suggestions.slice(0, 5), // Top 5 suggestions
    message: `Icon '${iconName}' not found. Available alternatives: ${suggestions.join(', ')}`
  }
}

// Example usage:
// console.log(verifyIconWithSuggestions('Filter', 'filter'))
// console.log(verifyIconWithSuggestions('ChevronDown', 'chevron'))
