const REORDER_LEVELS_STORAGE_KEY = 'royal_inventory_custom_reorder_levels';

/**
 * Get all custom reorder thresholds saved in localStorage
 */
export const getCustomReorderLevels = (): Record<string, number> => {
  try {
    const data = localStorage.getItem(REORDER_LEVELS_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

/**
 * Get threshold for a specific item code, falling back to default level (default 0)
 */
export const getItemReorderLevel = (itemCode: string, defaultLevel: number = 0): number => {
  if (!itemCode) return defaultLevel;
  const levels = getCustomReorderLevels();
  if (levels[itemCode] !== undefined && typeof levels[itemCode] === 'number') {
    return levels[itemCode];
  }
  return defaultLevel;
};

/**
 * Set custom alert threshold for a specific item code
 */
export const setItemReorderLevel = (itemCode: string, level: number): void => {
  if (!itemCode) return;
  const levels = getCustomReorderLevels();
  levels[itemCode] = Math.max(0, Number(level));
  try {
    localStorage.setItem(REORDER_LEVELS_STORAGE_KEY, JSON.stringify(levels));
  } catch (err) {
    console.error('Failed to save custom reorder level:', err);
  }
};
