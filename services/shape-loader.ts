/**
 * Shape Loader Service
 * Manages efficient lazy-loading of rail route shapes based on viewport
 * Uses bounding box indexing for fast spatial queries
 */

import type { Shape } from '../types/train';

export interface ShapeBounds {
  id: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  pointCount: number;
}

export interface ViewportBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface VisibleShape {
  id: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
}

export class ShapeLoader {
  private shapeBounds: Map<string, ShapeBounds> = new Map();
  private shapeCoordinates: Map<string, Array<{ latitude: number; longitude: number }>> = new Map();

  /**
   * Initialize shape loader with all shapes data
   * Pre-computes bounding boxes for fast spatial queries
   */
  initialize(shapes: Record<string, Shape[]>): void {
    this.shapeBounds.clear();
    this.shapeCoordinates.clear();

    Object.entries(shapes).forEach(([shapeId, points]) => {
      if (points.length === 0) return;

      // Compute bounding box
      let minLat = points[0].shape_pt_lat;
      let maxLat = points[0].shape_pt_lat;
      let minLon = points[0].shape_pt_lon;
      let maxLon = points[0].shape_pt_lon;

      const coordinates: Array<{ latitude: number; longitude: number }> = [];

      for (const point of points) {
        minLat = Math.min(minLat, point.shape_pt_lat);
        maxLat = Math.max(maxLat, point.shape_pt_lat);
        minLon = Math.min(minLon, point.shape_pt_lon);
        maxLon = Math.max(maxLon, point.shape_pt_lon);

        coordinates.push({
          latitude: point.shape_pt_lat,
          longitude: point.shape_pt_lon,
        });
      }

      this.shapeBounds.set(shapeId, {
        id: shapeId,
        minLat,
        maxLat,
        minLon,
        maxLon,
        pointCount: points.length,
      });

      this.shapeCoordinates.set(shapeId, coordinates);
    });
  }

  /**
   * Get shapes visible in the given viewport with padding
   * Adds padding to load shapes slightly outside viewport for smoother panning
   */
  getVisibleShapes(viewport: ViewportBounds, paddingDegrees: number = 0.1): VisibleShape[] {
    const paddedBounds = {
      minLat: viewport.minLat - paddingDegrees,
      maxLat: viewport.maxLat + paddingDegrees,
      minLon: viewport.minLon - paddingDegrees,
      maxLon: viewport.maxLon + paddingDegrees,
    };

    const visible: VisibleShape[] = [];

    // Query bounding boxes for intersection
    for (const [shapeId, bounds] of this.shapeBounds) {
      if (this.boundsIntersect(bounds, paddedBounds)) {
        const coordinates = this.shapeCoordinates.get(shapeId);
        if (coordinates) {
          visible.push({
            id: shapeId,
            coordinates,
          });
        }
      }
    }

    return visible;
  }

  /**
   * Check if two bounding boxes intersect
   */
  private boundsIntersect(bounds1: ShapeBounds, bounds2: ViewportBounds): boolean {
    return !(
      bounds1.maxLat < bounds2.minLat ||
      bounds1.minLat > bounds2.maxLat ||
      bounds1.maxLon < bounds2.minLon ||
      bounds1.minLon > bounds2.maxLon
    );
  }

  /**
   * Get all shapes without viewport filtering
   */
  getAllShapes(): VisibleShape[] {
    const all: VisibleShape[] = [];
    for (const [shapeId, coordinates] of this.shapeCoordinates) {
      all.push({ id: shapeId, coordinates });
    }
    return all;
  }

  /**
   * Get statistics about loaded shapes
   */
  getStats() {
    let totalPoints = 0;
    let maxPoints = 0;
    let minPoints = Infinity;

    for (const bounds of this.shapeBounds.values()) {
      totalPoints += bounds.pointCount;
      maxPoints = Math.max(maxPoints, bounds.pointCount);
      minPoints = Math.min(minPoints, bounds.pointCount);
    }

    return {
      totalShapes: this.shapeBounds.size,
      totalPoints,
      averagePointsPerShape: Math.round(totalPoints / (this.shapeBounds.size || 1)),
      maxPointsInShape: maxPoints,
      minPointsInShape: minPoints,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.shapeBounds.clear();
    this.shapeCoordinates.clear();
  }
}

// Export singleton instance
export const shapeLoader = new ShapeLoader();
