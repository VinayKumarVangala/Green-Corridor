// /lib/ai/emergencyRoutingWithExceptions.ts

import { createEnhancedHackCity } from '../simulation/enhancedMapData';
import { TrafficObstacleSimulator } from '../simulation/trafficObstacleSimulator';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RouteCalculationOptions {
  allowOneWayViolation: boolean;
  allowNoEntryViolation: boolean;
  prioritizeShortcuts: boolean;
  avoidBlockedRoads: boolean;
  blockedSegments?: string[];
}

export class EmergencyRouter {
  private cityData = createEnhancedHackCity();
  private obstacleSimulator: TrafficObstacleSimulator;
  
  constructor(obstacleSimulator: TrafficObstacleSimulator) {
    this.obstacleSimulator = obstacleSimulator;
  }
  
  // Calculate optimal route with emergency exceptions
  calculateRoute(
    start: GeoPoint,
    end: GeoPoint,
    options: RouteCalculationOptions = {
      allowOneWayViolation: true,
      allowNoEntryViolation: true,
      prioritizeShortcuts: true,
      avoidBlockedRoads: true
    }
  ): {
    segments: string[];
    totalDistance: number;
    estimatedTime: number; // minutes
    hasTrafficViolations: boolean;
    violations: string[];
    alternativeRoutes: Array<{ segments: string[]; estimatedTime: number }>;
  } {
    
    // Find nearest nodes to start and end
    const startNode = this.findNearestNode(start);
    const endNode = this.findNearestNode(end);
    
    // Implement A* pathfinding with weighted edges
    const path = this.aStarPathfinding(startNode.id, endNode.id, options);
    
    // Check for traffic obstacles on path
    const obstaclesOnPath = this.checkObstaclesOnPath(path.segments);
    
    // If obstacles found, recalculate with avoidance
    if (obstaclesOnPath.length > 0 && options.avoidBlockedRoads) {
      const alternativePath = this.aStarPathfinding(startNode.id, endNode.id, {
        ...options,
        avoidBlockedRoads: true,
        blockedSegments: obstaclesOnPath.map(o => o.roadSegmentId)
      });
      
      return {
        ...alternativePath,
        alternativeRoutes: [path, alternativePath]
      };
    }
    
    return path;
  }
  
  private findNearestNode(point: GeoPoint) {
    let nearestNode = this.cityData.roadNodes[0];
    let minDistance = Infinity;
    
    for (const node of this.cityData.roadNodes) {
      const distance = Math.hypot(node.position.lat - point.lat, node.position.lng - point.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestNode = node;
      }
    }
    
    return nearestNode;
  }
  
  private aStarPathfinding(
    startNodeId: string,
    endNodeId: string,
    options: RouteCalculationOptions
  ): { segments: string[]; totalDistance: number; estimatedTime: number; hasTrafficViolations: boolean; violations: string[]; alternativeRoutes: Array<{ segments: string[]; estimatedTime: number }> } {
    
    // Implementation of A* algorithm
    // This would include:
    // 1. Graph traversal with edge weights based on:
    //    - Distance
    //    - Speed limit
    //    - Traffic level
    //    - One-way violations if allowed
    //    - No-entry violations if allowed
    
    // Simplified for demo - actual implementation would be more complex
    const segments: string[] = [];
    let totalDistance = 0;
    let estimatedTime = 0;
    let hasTrafficViolations = false;
    const violations: string[] = [];
    const alternativeRoutes: Array<{ segments: string[]; estimatedTime: number }> = [];
    
    // TODO: Implement full A* algorithm with all constraints
    // This is a placeholder - actual implementation needed
    
    return { segments, totalDistance, estimatedTime, hasTrafficViolations, violations, alternativeRoutes };
  }
  
  private checkObstaclesOnPath(segments: string[]) {
    const activeObstacles = this.obstacleSimulator.getActiveObstacles();
    return activeObstacles.filter(obs => segments.includes(obs.roadSegmentId));
  }
  
  // Check if ambulance can legally use a road segment
  canUseRoadSegment(segmentId: string, options: RouteCalculationOptions): boolean {
    const segment = this.cityData.roadSegments.find(r => r.id === segmentId);
    if (!segment) return false;
    
    // Check if blocked
    if (segment.isBlocked && options.avoidBlockedRoads) return false;
    
    // Check one-way rules
    const oneWayRule = this.cityData.oneWayRules.find(r => r.roadSegmentId === segmentId);
    if (oneWayRule && oneWayRule.enforced) {
      if (!options.allowOneWayViolation) return false;
    }
    
    // Check no-entry zones
    const noEntryZone = this.cityData.noEntryZones.find(z => z.roadSegmentIds.includes(segmentId));
    if (noEntryZone) {
      if (!options.allowNoEntryViolation) return false;
    }
    
    return true;
  }
}