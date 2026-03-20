// /lib/simulation/trafficObstacleSimulator.ts

import { createEnhancedHackCity } from './enhancedMapData';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface TrafficObstacle {
  id: string;
  type: 'accident' | 'road_closure' | 'traffic_jam' | 'construction';
  roadSegmentId: string;
  location: GeoPoint;
  severity: 'minor' | 'moderate' | 'severe';
  startTime: Date;
  estimatedDuration: number; // minutes
  affectsTrafficFlow: boolean;
  isActive: boolean;
}

export class TrafficObstacleSimulator {
  private cityData = createEnhancedHackCity();
  private activeObstacles: TrafficObstacle[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  
  // Generate random obstacle on a road segment
  private generateRandomObstacle(): TrafficObstacle | null {
    const availableRoads = this.cityData.roadSegments.filter(r => !r.isBlocked);
    if (availableRoads.length === 0) return null;
    
    const road = availableRoads[Math.floor(Math.random() * availableRoads.length)];
    const fromNode = this.cityData.roadNodes.find(n => n.id === road.fromNodeId);
    const toNode = this.cityData.roadNodes.find(n => n.id === road.toNodeId);
    
    if (!fromNode || !toNode) return null;
    
    // Calculate midpoint for obstacle location
    const midPoint: GeoPoint = {
      lat: (fromNode.position.lat + toNode.position.lat) / 2,
      lng: (fromNode.position.lng + toNode.position.lng) / 2
    };
    
    const obstacleTypes: TrafficObstacle['type'][] = ['accident', 'road_closure', 'traffic_jam', 'construction'];
    const severities: TrafficObstacle['severity'][] = ['minor', 'moderate', 'severe'];
    
    return {
      id: `OBS-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)],
      roadSegmentId: road.id,
      location: midPoint,
      severity: severities[Math.floor(Math.random() * severities.length)],
      startTime: new Date(),
      estimatedDuration: Math.floor(Math.random() * 30) + 5, // 5-35 minutes
      affectsTrafficFlow: true,
      isActive: true
    };
  }
  
  // Apply obstacle to road segment
  private applyObstacleToRoad(obstacle: TrafficObstacle) {
    const road = this.cityData.roadSegments.find(r => r.id === obstacle.roadSegmentId);
    if (road) {
      road.isBlocked = true;
      road.trafficLevel = 'blocked';
    }
  }
  
  // Clear obstacle from road segment
  private clearObstacleFromRoad(obstacle: TrafficObstacle) {
    const road = this.cityData.roadSegments.find(r => r.id === obstacle.roadSegmentId);
    if (road) {
      road.isBlocked = false;
      road.trafficLevel = 'medium'; // Reset to default
    }
  }
  
  // Start random obstacle generation
  startGenerating(intervalSeconds: number = 45, callback?: (obstacle: TrafficObstacle) => void) {
    if (this.intervalId) {
      this.stopGenerating();
    }
    
    this.intervalId = setInterval(() => {
      // 30% chance to generate a new obstacle
      if (Math.random() < 0.3) {
        const obstacle = this.generateRandomObstacle();
        if (obstacle) {
          this.activeObstacles.push(obstacle);
          this.applyObstacleToRoad(obstacle);
          
          if (callback) callback(obstacle);
          
          // Schedule obstacle removal
          setTimeout(() => {
            this.removeObstacle(obstacle.id);
          }, obstacle.estimatedDuration * 60 * 1000);
        }
      }
    }, intervalSeconds * 1000);
  }
  
  stopGenerating() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  removeObstacle(obstacleId: string): boolean {
    const index = this.activeObstacles.findIndex(o => o.id === obstacleId);
    if (index !== -1) {
      const obstacle = this.activeObstacles[index];
      this.clearObstacleFromRoad(obstacle);
      this.activeObstacles.splice(index, 1);
      return true;
    }
    return false;
  }
  
  getActiveObstacles(): TrafficObstacle[] {
    return this.activeObstacles;
  }
  
  // Manually trigger obstacle on specific road
  triggerManualObstacle(roadSegmentId: string, type: TrafficObstacle['type']): TrafficObstacle | null {
    const road = this.cityData.roadSegments.find(r => r.id === roadSegmentId);
    if (!road) return null;
    
    const fromNode = this.cityData.roadNodes.find(n => n.id === road.fromNodeId);
    const toNode = this.cityData.roadNodes.find(n => n.id === road.toNodeId);
    
    if (!fromNode || !toNode) return null;
    
    const midPoint: GeoPoint = {
      lat: (fromNode.position.lat + toNode.position.lat) / 2,
      lng: (fromNode.position.lng + toNode.position.lng) / 2
    };
    
    const obstacle: TrafficObstacle = {
      id: `OBS-MANUAL-${Date.now()}`,
      type,
      roadSegmentId,
      location: midPoint,
      severity: 'severe',
      startTime: new Date(),
      estimatedDuration: 10,
      affectsTrafficFlow: true,
      isActive: true
    };
    
    this.activeObstacles.push(obstacle);
    this.applyObstacleToRoad(obstacle);
    
    return obstacle;
  }
}