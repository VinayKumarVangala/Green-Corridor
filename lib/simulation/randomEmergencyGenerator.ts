// /lib/simulation/randomEmergencyGenerator.ts

import { createEnhancedHackCity } from './enhancedMapData';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RandomEmergency {
  id: string;
  citizenName: string;
  citizenPhone: string;
  location: GeoPoint;
  address: string;
  emergencyType: 'heart_attack' | 'accident' | 'stroke' | 'pregnancy' | 'fire' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export class RandomEmergencyGenerator {
  private cityData = createEnhancedHackCity();
  private activeEmergencies: RandomEmergency[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  
  // Random citizen names for demo
  private citizenNames = [
    'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Neha Gupta', 
    'Vikram Singh', 'Anjali Nair', 'Sunil Reddy', 'Kavita Joshi',
    'Rahul Verma', 'Meera Iyer', 'Arjun Nair', 'Divya Menon'
  ];
  
  private emergencyTypes: RandomEmergency['emergencyType'][] = [
    'heart_attack', 'accident', 'stroke', 'pregnancy', 'fire', 'other'
  ];
  
  // Generate random point within city bounds
  private generateRandomLocation(): GeoPoint {
    // Center around city center with random offset up to 3km
    const offsetLat = (Math.random() - 0.5) * 0.05; // ~5km range
    const offsetLng = (Math.random() - 0.5) * 0.05;
    
    return {
      lat: this.cityData.cityCenter.lat + offsetLat,
      lng: this.cityData.cityCenter.lng + offsetLng
    };
  }
  
  // Reverse geocode to get address (simulated)
  private getAddressFromLocation(lat: number, lng: number): string {
    // Find nearest road or landmark
    let nearestDistance = Infinity;
    let nearestRoad = '';
    
    for (const road of this.cityData.roadSegments) {
      const fromNode = this.cityData.roadNodes.find(n => n.id === road.fromNodeId);
      const toNode = this.cityData.roadNodes.find(n => n.id === road.toNodeId);
      
      if (fromNode && toNode) {
        const midLat = (fromNode.position.lat + toNode.position.lat) / 2;
        const midLng = (fromNode.position.lng + toNode.position.lng) / 2;
        const distance = Math.hypot(midLat - lat, midLng - lng);
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestRoad = road.name;
        }
      }
    }
    
    const sector = Math.floor(Math.random() * 10) + 1;
    return `${nearestRoad || 'Main Road'}, Sector ${sector}`;
  }
  
  // Generate a random emergency
  generateEmergency(): RandomEmergency {
    const location = this.generateRandomLocation();
    const emergencyType = this.emergencyTypes[Math.floor(Math.random() * this.emergencyTypes.length)];
    const severity = ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as RandomEmergency['severity'];
    
    return {
      id: `EMG-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      citizenName: this.citizenNames[Math.floor(Math.random() * this.citizenNames.length)],
      citizenPhone: `+91-${Math.floor(9000000000 + Math.random() * 1000000000)}`,
      location,
      address: this.getAddressFromLocation(location.lat, location.lng),
      emergencyType,
      severity,
      timestamp: new Date()
    };
  }
  
  // Start automatic emergency generation
  startGenerating(intervalSeconds: number = 30, callback: (emergency: RandomEmergency) => void) {
    if (this.intervalId) {
      this.stopGenerating();
    }
    
    this.intervalId = setInterval(() => {
      const emergency = this.generateEmergency();
      this.activeEmergencies.push(emergency);
      callback(emergency);
      
      // Keep only last 50 emergencies in memory
      if (this.activeEmergencies.length > 50) {
        this.activeEmergencies.shift();
      }
    }, intervalSeconds * 1000);
  }
  
  stopGenerating() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  getActiveEmergencies(): RandomEmergency[] {
    return this.activeEmergencies;
  }
  
  // Manual trigger for testing
  triggerManualEmergency(location?: GeoPoint): RandomEmergency {
    const emergency = this.generateEmergency();
    if (location) {
      emergency.location = location;
      emergency.address = this.getAddressFromLocation(location.lat, location.lng);
    }
    this.activeEmergencies.push(emergency);
    return emergency;
  }
}