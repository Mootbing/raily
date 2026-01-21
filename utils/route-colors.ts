/**
 * Route color utilities for train route visualization
 * Provides color coding based on route type and characteristics
 */

export interface RouteColorScheme {
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

/**
 * Get color for a route based on its ID or characteristics
 * All routes use white color with 25% opacity for consistency
 */
export function getRouteColor(shapeId: string): RouteColorScheme {
  // All routes use white color with 25% opacity
  return {
    stroke: '#FFFFFF',
    strokeWidth: 2,
    opacity: 1,
  };
}

/**
 * Get colored route scheme with unique colors per route
 */
export function getColoredRouteColor(shapeId: string): RouteColorScheme {
  const shapeIdLower = shapeId.toLowerCase();

  // Acela Express - Premium high-speed service
  if (shapeIdLower.includes('acela') || shapeIdLower.includes('2150')) {
    return {
      stroke: '#E31837', // Amtrak red
      strokeWidth: 2,
      opacity: 0.8,
    };
  }

  // Northeast Regional
  if (shapeIdLower.includes('northeast') || shapeIdLower.includes('regional')) {
    return {
      stroke: '#0066CC', // Blue
      strokeWidth: 2,
      opacity: 0.7,
    };
  }

  // Use hash-based color for other routes
  return {
    stroke: getConsistentColorFromId(shapeId),
    strokeWidth: 2,
    opacity: 0.7,
  };
}

/**
 * Generate a consistent color from a string ID
 * Same ID will always produce the same color
 */
function getConsistentColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate color with good saturation and brightness
  const hue = Math.abs(hash % 360);
  const saturation = 50 + (Math.abs(hash >> 8) % 20); // 50-70%
  const lightness = 50 + (Math.abs(hash >> 16) % 15); // 50-65%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get stroke width based on zoom level
 * Always returns 2px for consistent styling
 */
export function getStrokeWidthForZoom(latitudeDelta: number): number {
  return 2;
}
