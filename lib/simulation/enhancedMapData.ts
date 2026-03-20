// /lib/simulation/enhancedMapData.ts

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RoadNode {
  id: string;
  position: GeoPoint;
  isJunction: boolean;
  junctionId?: string;
  trafficLightId?: string;
}

export interface RoadSegment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  name: string;
  type: 'main_road' | 'street' | 'service_road' | 'one_way' | 'highway';
  oneWay: boolean;
  allowedDirections: ('forward' | 'backward')[];
  speedLimit: number; // km/h
  length: number; // meters
  isBlocked: boolean;
  trafficLevel: 'low' | 'medium' | 'high' | 'blocked';
  width: number; // meters, for ambulance clearance
}

export interface TrafficSignal {
  id: string;
  junctionId: string;
  position: GeoPoint;
  timing: {
    greenDuration: number; // seconds
    redDuration: number;
    emergencyOverride: boolean;
  };
}

export interface Hospital {
  id: string;
  name: string;
  position: GeoPoint;
  address: string;
  capacity: number;
  currentOccupancy: number;
  emergencyWing: boolean;
  traumaCenter: boolean;
  specialties: string[];
  ambulanceBay: boolean;
  contactNumber: string;
}

export interface PoliceStation {
  id: string;
  name: string;
  position: GeoPoint;
  jurisdiction: string[];
  contactNumber: string;
}

export interface AmbulanceHaltStation {
  id: string;
  name: string;
  position: GeoPoint;
  baseHospitals: string[]; // hospital IDs they're affiliated with
  capacity: number; // number of ambulances that can be stationed
  activeAmbulances: string[]; // ambulance IDs currently stationed
}

export interface Ambulance {
  id: string;
  vehicleNumber: string;
  type: 'basic' | 'advanced' | 'icu';
  status: 'available' | 'en_route' | 'busy' | 'maintenance';
  currentLocation: GeoPoint;
  assignedStation: string; // halt station ID
  isMoving: boolean;
  currentRoute?: string[]; // road segment IDs
  lastUpdate: Date;
}

export interface OneWayRule {
  roadSegmentId: string;
  direction: 'north_to_south' | 'south_to_north' | 'east_to_west' | 'west_to_east';
  enforced: boolean;
  emergencyExemption: boolean; // Can ambulances break this rule?
}

export interface NoEntryZone {
  id: string;
  area: GeoPoint[]; // polygon coordinates
  roadSegmentIds: string[];
  emergencyExemption: boolean;
}

export const createEnhancedHackCity = () => {
  // Define city boundaries (10km x 10km grid for demo)
  const cityCenter: GeoPoint = { lat: 28.6139, lng: 77.2090 }; // Example coordinates
  const cityRadius = 5000; // meters

  // ============ 1. FIXED LOCATIONS: HOSPITALS ============
  const hospitals: Hospital[] = [
    {
      id: 'H001',
      name: 'City General Hospital',
      position: { lat: 28.6145, lng: 77.2100 },
      address: 'Main Road, Sector 1',
      capacity: 200,
      currentOccupancy: 45,
      emergencyWing: true,
      traumaCenter: true,
      specialties: ['cardiac', 'trauma', 'general'],
      ambulanceBay: true,
      contactNumber: '+91-11-12345601'
    },
    {
      id: 'H002',
      name: 'Memorial Medical Center',
      position: { lat: 28.6220, lng: 77.2180 },
      address: 'North Avenue, Sector 2',
      capacity: 150,
      currentOccupancy: 78,
      emergencyWing: true,
      traumaCenter: true,
      specialties: ['cardiac', 'neurology', 'pediatrics'],
      ambulanceBay: true,
      contactNumber: '+91-11-12345602'
    },
    {
      id: 'H003',
      name: 'St. Mary\'s Hospital',
      position: { lat: 28.6050, lng: 77.2000 },
      address: 'South District, Sector 3',
      capacity: 120,
      currentOccupancy: 32,
      emergencyWing: true,
      traumaCenter: false,
      specialties: ['general', 'maternity'],
      ambulanceBay: true,
      contactNumber: '+91-11-12345603'
    },
    {
      id: 'H004',
      name: 'University Medical Center',
      position: { lat: 28.6300, lng: 77.2150 },
      address: 'East Campus, Sector 4',
      capacity: 300,
      currentOccupancy: 156,
      emergencyWing: true,
      traumaCenter: true,
      specialties: ['cardiac', 'trauma', 'neurology', 'pediatrics'],
      ambulanceBay: true,
      contactNumber: '+91-11-12345604'
    },
    {
      id: 'H005',
      name: 'Westside Community Hospital',
      position: { lat: 28.6000, lng: 77.1950 },
      address: 'West End, Sector 5',
      capacity: 80,
      currentOccupancy: 41,
      emergencyWing: true,
      traumaCenter: false,
      specialties: ['general', 'geriatric'],
      ambulanceBay: true,
      contactNumber: '+91-11-12345605'
    }
  ];

  // ============ 2. FIXED LOCATIONS: POLICE STATIONS ============
  const policeStations: PoliceStation[] = [
    {
      id: 'PS001',
      name: 'Central Police Station',
      position: { lat: 28.6130, lng: 77.2080 },
      jurisdiction: ['Sector 1', 'Sector 2'],
      contactNumber: '+91-11-12345701'
    },
    {
      id: 'PS002',
      name: 'North Precinct',
      position: { lat: 28.6250, lng: 77.2200 },
      jurisdiction: ['Sector 3', 'Sector 4'],
      contactNumber: '+91-11-12345702'
    },
    {
      id: 'PS003',
      name: 'South Traffic Control',
      position: { lat: 28.6000, lng: 77.1980 },
      jurisdiction: ['Sector 5', 'Sector 6'],
      contactNumber: '+91-11-12345703'
    }
  ];

  // ============ 3. AMBULANCE HALT STATIONS ============
  const ambulanceHaltStations: AmbulanceHaltStation[] = [
    {
      id: 'AHS001',
      name: 'Central Ambulance Depot',
      position: { lat: 28.6150, lng: 77.2120 },
      baseHospitals: ['H001', 'H002'],
      capacity: 5,
      activeAmbulances: ['AMB001', 'AMB002', 'AMB003']
    },
    {
      id: 'AHS002',
      name: 'Northside Ambulance Base',
      position: { lat: 28.6280, lng: 77.2160 },
      baseHospitals: ['H002', 'H004'],
      capacity: 4,
      activeAmbulances: ['AMB004', 'AMB005']
    },
    {
      id: 'AHS003',
      name: 'Southside Emergency Hub',
      position: { lat: 28.6020, lng: 77.1990 },
      baseHospitals: ['H003', 'H005'],
      capacity: 3,
      activeAmbulances: ['AMB006']
    }
  ];

  // ============ 4. AMBULANCES (Some stationary, some moving) ============
  const ambulances: Ambulance[] = [
    // Stationary ambulances at halt stations
    {
      id: 'AMB001',
      vehicleNumber: 'DL-01-AB-1234',
      type: 'advanced',
      status: 'available',
      currentLocation: { lat: 28.6150, lng: 77.2120 },
      assignedStation: 'AHS001',
      isMoving: false,
      lastUpdate: new Date()
    },
    {
      id: 'AMB002',
      vehicleNumber: 'DL-01-AB-1235',
      type: 'basic',
      status: 'available',
      currentLocation: { lat: 28.6151, lng: 77.2121 },
      assignedStation: 'AHS001',
      isMoving: false,
      lastUpdate: new Date()
    },
    {
      id: 'AMB003',
      vehicleNumber: 'DL-01-AB-1236',
      type: 'icu',
      status: 'available',
      currentLocation: { lat: 28.6149, lng: 77.2119 },
      assignedStation: 'AHS001',
      isMoving: false,
      lastUpdate: new Date()
    },
    // Moving ambulances (patrolling)
    {
      id: 'AMB004',
      vehicleNumber: 'DL-01-AB-1237',
      type: 'advanced',
      status: 'available',
      currentLocation: { lat: 28.6180, lng: 77.2140 },
      assignedStation: 'AHS002',
      isMoving: true,
      currentRoute: ['R001', 'R002', 'R003'],
      lastUpdate: new Date()
    },
    {
      id: 'AMB005',
      vehicleNumber: 'DL-01-AB-1238',
      type: 'basic',
      status: 'available',
      currentLocation: { lat: 28.6220, lng: 77.2170 },
      assignedStation: 'AHS002',
      isMoving: true,
      currentRoute: ['R004', 'R005'],
      lastUpdate: new Date()
    },
    {
      id: 'AMB006',
      vehicleNumber: 'DL-01-AB-1239',
      type: 'advanced',
      status: 'available',
      currentLocation: { lat: 28.6040, lng: 77.2010 },
      assignedStation: 'AHS003',
      isMoving: false,
      lastUpdate: new Date()
    }
  ];

  // ============ 5. ROAD NETWORK WITH TRAFFIC RULES ============
  const roadNodes: RoadNode[] = [
    // Main intersections (junctions with traffic signals)
    { id: 'N001', position: { lat: 28.6139, lng: 77.2090 }, isJunction: true, junctionId: 'J001', trafficLightId: 'TL001' },
    { id: 'N002', position: { lat: 28.6180, lng: 77.2120 }, isJunction: true, junctionId: 'J002', trafficLightId: 'TL002' },
    { id: 'N003', position: { lat: 28.6080, lng: 77.2070 }, isJunction: true, junctionId: 'J003', trafficLightId: 'TL003' },
    { id: 'N004', position: { lat: 28.6220, lng: 77.2180 }, isJunction: true, junctionId: 'J004', trafficLightId: 'TL004' },
    { id: 'N005', position: { lat: 28.6050, lng: 77.2000 }, isJunction: true, junctionId: 'J005', trafficLightId: 'TL005' },
    { id: 'N006', position: { lat: 28.6300, lng: 77.2150 }, isJunction: true, junctionId: 'J006', trafficLightId: 'TL006' },
    { id: 'N007', position: { lat: 28.6000, lng: 77.1950 }, isJunction: true, junctionId: 'J007', trafficLightId: 'TL007' },
    // Intermediate nodes (street corners, no signals)
    { id: 'N008', position: { lat: 28.6155, lng: 77.2105 }, isJunction: false },
    { id: 'N009', position: { lat: 28.6170, lng: 77.2130 }, isJunction: false },
    { id: 'N010', position: { lat: 28.6205, lng: 77.2155 }, isJunction: false },
  ];

  const roadSegments: RoadSegment[] = [
    // Main roads (2-way)
    {
      id: 'R001', fromNodeId: 'N001', toNodeId: 'N002',
      name: 'Main Boulevard', type: 'main_road', oneWay: false,
      allowedDirections: ['forward', 'backward'], speedLimit: 50, length: 450,
      isBlocked: false, trafficLevel: 'medium', width: 12
    },
    {
      id: 'R002', fromNodeId: 'N002', toNodeId: 'N004',
      name: 'North Avenue', type: 'main_road', oneWay: false,
      allowedDirections: ['forward', 'backward'], speedLimit: 50, length: 380,
      isBlocked: false, trafficLevel: 'low', width: 12
    },
    {
      id: 'R003', fromNodeId: 'N001', toNodeId: 'N003',
      name: 'South Street', type: 'main_road', oneWay: false,
      allowedDirections: ['forward', 'backward'], speedLimit: 50, length: 520,
      isBlocked: false, trafficLevel: 'high', width: 10
    },
    // One-way roads
    {
      id: 'R004', fromNodeId: 'N002', toNodeId: 'N009',
      name: 'Market Lane', type: 'one_way', oneWay: true,
      allowedDirections: ['forward'], speedLimit: 30, length: 200,
      isBlocked: false, trafficLevel: 'medium', width: 6
    },
    {
      id: 'R005', fromNodeId: 'N009', toNodeId: 'N008',
      name: 'Bazaar Road', type: 'one_way', oneWay: true,
      allowedDirections: ['forward'], speedLimit: 25, length: 180,
      isBlocked: false, trafficLevel: 'high', width: 5
    },
    // Service roads (narrow, for shortcuts)
    {
      id: 'R006', fromNodeId: 'N008', toNodeId: 'N003',
      name: 'Service Lane', type: 'service_road', oneWay: false,
      allowedDirections: ['forward', 'backward'], speedLimit: 20, length: 150,
      isBlocked: false, trafficLevel: 'low', width: 4
    },
    // Highway
    {
      id: 'R007', fromNodeId: 'N004', toNodeId: 'N006',
      name: 'Ring Road', type: 'highway', oneWay: false,
      allowedDirections: ['forward', 'backward'], speedLimit: 80, length: 850,
      isBlocked: false, trafficLevel: 'low', width: 20
    }
  ];

  // ============ 6. TRAFFIC SIGNALS ============
  const trafficSignals: TrafficSignal[] = [
    {
      id: 'TL001', junctionId: 'J001',
      position: { lat: 28.6139, lng: 77.2090 },
      timing: { greenDuration: 30, redDuration: 30, emergencyOverride: false }
    },
    {
      id: 'TL002', junctionId: 'J002',
      position: { lat: 28.6180, lng: 77.2120 },
      timing: { greenDuration: 35, redDuration: 25, emergencyOverride: false }
    },
    {
      id: 'TL003', junctionId: 'J003',
      position: { lat: 28.6080, lng: 77.2070 },
      timing: { greenDuration: 25, redDuration: 35, emergencyOverride: false }
    }
  ];

  // ============ 7. ONE-WAY RULES ============
  const oneWayRules: OneWayRule[] = [
    { roadSegmentId: 'R004', direction: 'north_to_south', enforced: true, emergencyExemption: true },
    { roadSegmentId: 'R005', direction: 'east_to_west', enforced: true, emergencyExemption: true }
  ];

  // ============ 8. NO-ENTRY ZONES ============
  const noEntryZones: NoEntryZone[] = [
    {
      id: 'NEZ001',
      area: [
        { lat: 28.6160, lng: 77.2110 },
        { lat: 28.6170, lng: 77.2110 },
        { lat: 28.6170, lng: 77.2120 },
        { lat: 28.6160, lng: 77.2120 }
      ],
      roadSegmentIds: ['R004'],
      emergencyExemption: true // Ambulances can enter
    }
  ];

  return {
    hospitals,
    policeStations,
    ambulanceHaltStations,
    ambulances,
    roadNodes,
    roadSegments,
    trafficSignals,
    oneWayRules,
    noEntryZones,
    cityCenter,
    cityRadius
  };
};