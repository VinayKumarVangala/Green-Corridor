// /components/modules/admin/EmergencySimulationControl.tsx

import { useEffect, useState } from 'react';
import { RandomEmergencyGenerator, RandomEmergency } from '@/lib/simulation/randomEmergencyGenerator';
import { TrafficObstacleSimulator, TrafficObstacle } from '@/lib/simulation/trafficObstacleSimulator';
import { EmergencyRouter } from '@/lib/ai/emergencyRoutingWithExceptions';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Activity, Car, Hospital, Navigation } from 'lucide-react';

export default function EmergencySimulationControl() {
  const [emergencyGen, setEmergencyGen] = useState<RandomEmergencyGenerator | null>(null);
  const [obstacleSim, setObstacleSim] = useState<TrafficObstacleSimulator | null>(null);
  const [activeEmergencies, setActiveEmergencies] = useState<RandomEmergency[]>([]);
  const [activeObstacles, setActiveObstacles] = useState<TrafficObstacle[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState<RandomEmergency | null>(null);
  const [calculatedRoute, setCalculatedRoute] = useState<any>(null);
  
  // Initialize simulators
  useEffect(() => {
    const emergencyGenerator = new RandomEmergencyGenerator();
    const obstacleSimulator = new TrafficObstacleSimulator();
    
    setEmergencyGen(emergencyGenerator);
    setObstacleSim(obstacleSimulator);
    
    return () => {
      emergencyGenerator.stopGenerating();
      obstacleSimulator.stopGenerating();
    };
  }, []);
  
  // Start simulation
  const startSimulation = () => {
    if (!emergencyGen || !obstacleSim) return;
    
    // Start generating random emergencies every 20-45 seconds
    emergencyGen.startGenerating(30, (emergency) => {
      setActiveEmergencies(prev => [emergency, ...prev]);
      
      // Auto-assign nearest ambulance
      autoAssignAmbulance(emergency);
      
      // Show toast notification
      showNotification(`🚨 EMERGENCY: ${emergency.emergencyType.toUpperCase()} at ${emergency.address}`);
    });
    
    // Start generating random obstacles every 45 seconds
    obstacleSim.startGenerating(45, (obstacle) => {
      setActiveObstacles(prev => [...prev, obstacle]);
      showNotification(`⚠️ TRAFFIC: ${obstacle.type} reported on ${obstacle.roadSegmentId}`);
      
      // Trigger rerouting for affected ambulances
      triggerReroutingForObstacle(obstacle);
    });
    
    setIsSimulating(true);
  };
  
  // Stop simulation
  const stopSimulation = () => {
    emergencyGen?.stopGenerating();
    obstacleSim?.stopGenerating();
    setIsSimulating(false);
  };
  
  // Manual emergency trigger
  const triggerManualEmergency = () => {
    if (!emergencyGen) return;
    const emergency = emergencyGen.triggerManualEmergency();
    setActiveEmergencies(prev => [emergency, ...prev]);
    autoAssignAmbulance(emergency);
  };
  
  // Auto-assign nearest ambulance (simplified)
  const autoAssignAmbulance = (emergency: RandomEmergency) => {
    // This would call your AI dispatch logic
    console.log(`Assigning ambulance to emergency at ${emergency.address}`);
    // Dispatch logic here
  };
  
  // Trigger rerouting for obstacle
  const triggerReroutingForObstacle = (obstacle: TrafficObstacle) => {
    console.log(`Rerouting ambulances around obstacle on ${obstacle.roadSegmentId}`);
    // Reroute all affected ambulances
  };
  
  // Calculate route for selected emergency
  const calculateEmergencyRoute = (emergency: RandomEmergency) => {
    if (!obstacleSim) return;
    
    const router = new EmergencyRouter(obstacleSim);
    
    // Find nearest hospital
    const hospitals = [
      { id: 'H001', name: 'City General', lat: 28.6145, lng: 77.2100 },
      { id: 'H002', name: 'Memorial Medical', lat: 28.6220, lng: 77.2180 }
    ];
    
    const nearestHospital = hospitals[0]; // Simplified
    
    const route = router.calculateRoute(
      emergency.location,
      { lat: nearestHospital.lat, lng: nearestHospital.lng },
      {
        allowOneWayViolation: true,
        allowNoEntryViolation: true,
        prioritizeShortcuts: true,
        avoidBlockedRoads: true
      }
    );
    
    setCalculatedRoute(route);
    setSelectedEmergency(emergency);
  };
  
  const showNotification = (message: string) => {
    // Implement toast notification
    console.log(message);
  };
  
  return (
    <div className="p-6 space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🚨 Emergency Simulation Control</span>
            <div className="space-x-2">
              <Button
                variant={isSimulating ? 'destructive' : 'default'}
                onClick={isSimulating ? stopSimulation : startSimulation}
              >
                {isSimulating ? 'Stop Simulation' : 'Start Simulation'}
              </Button>
              <Button variant="outline" onClick={triggerManualEmergency}>
                Trigger Manual Emergency
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="text-red-500" />
                <span className="font-bold">Active Emergencies:</span>
                <Badge variant="destructive">{activeEmergencies.length}</Badge>
              </div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Car className="text-yellow-500" />
                <span className="font-bold">Traffic Obstacles:</span>
                <Badge variant="secondary">{activeObstacles.length}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Map View */}
      <Card className="h-[500px]">
        <CardContent className="p-0 h-full">
          <MapContainer
            center={[28.6139, 77.2090]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {/* Mark hospitals */}
            {/* Mark police stations */}
            {/* Show ambulances */}
            {/* Show active emergencies */}
            {/* Show obstacles */}
            {/* Show calculated route if any */}
          </MapContainer>
        </CardContent>
      </Card>
      
      {/* Active Emergencies List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Emergency Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activeEmergencies.slice(0, 10).map((emergency) => (
              <div
                key={emergency.id}
                className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                onClick={() => calculateEmergencyRoute(emergency)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">
                      {emergency.citizenName}
                      <Badge className="ml-2" variant={
                        emergency.severity === 'critical' ? 'destructive' :
                        emergency.severity === 'high' ? 'default' :
                        'secondary'
                      }>
                        {emergency.severity}
                      </Badge>
                    </p>
                    <p className="text-sm text-gray-600">{emergency.address}</p>
                    <p className="text-xs text-gray-500">
                      {emergency.emergencyType.toUpperCase()} • {emergency.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    <Navigation className="w-4 h-4 mr-1" />
                    Route
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Active Obstacles List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Traffic Obstacles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activeObstacles.map((obstacle) => (
              <div key={obstacle.id} className="p-3 border rounded-lg">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold capitalize">{obstacle.type}</p>
                    <p className="text-sm text-gray-600">Road: {obstacle.roadSegmentId}</p>
                    <p className="text-xs text-gray-500">
                      Severity: {obstacle.severity} • Duration: {obstacle.estimatedDuration} min
                    </p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}