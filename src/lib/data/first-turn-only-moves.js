/**
 * Movimientos que solo se pueden usar en el primer turno
 * Estos movimientos fallan si se usan después del primer turno
 */
export const firstTurnOnlyMoves = new Set([
  'fake-out',
  'first-impression',
])

/**
 * Verifica si un movimiento solo se puede usar en el primer turno
 * @param {string} moveName - Nombre del movimiento
 * @returns {boolean} - True si el movimiento solo se puede usar en el primer turno
 */
export const isFirstTurnOnlyMove = (moveName) => {
  return firstTurnOnlyMoves.has(moveName?.toLowerCase())
}

/**
 * Verifica si un movimiento puede ser usado en un turno específico
 * @param {string} moveName - Nombre del movimiento
 * @param {number} turnNumber - Número del turno (1 = primer turno)
 * @returns {boolean} - True si el movimiento puede ser usado
 */
export const canUseMoveInTurn = (moveName, turnNumber = 1) => {
  if (!isFirstTurnOnlyMove(moveName)) {
    return true // Movimientos normales se pueden usar en cualquier turno
  }
  
  return turnNumber === 1
}

/**
 * Obtiene un mensaje explicativo para movimientos de primer turno
 * @param {string} moveName - Nombre del movimiento
 * @returns {string} - Mensaje explicativo
 */
export const getFirstTurnMoveMessage = (moveName) => {
  if (!isFirstTurnOnlyMove(moveName)) {
    return ''
  }
  
  const messages = {
    'fake-out': 'Solo funciona en el primer turno',
    'first-impression': 'Solo funciona en el primer turno',
  }
  
  return messages[moveName?.toLowerCase()] || 'Solo funciona en el primer turno'
}
