// Chennai Safety Zone Data — Real locations with simulated safety scores
export const CHENNAI_CENTER = [13.0827, 80.2707];

// Unsafe zones — polygons with danger levels
export const DANGER_ZONES = [
  {
    name: 'Royapuram Back Streets',
    level: 'high', score: 82,
    center: [13.1070, 80.2940],
    radius: 500,
    reason: 'Poor lighting, isolated alleys',
  },
  {
    name: 'Perambur Railway Area',
    level: 'high', score: 75,
    center: [13.1150, 80.2350],
    radius: 400,
    reason: 'Deserted after 9 PM, low surveillance',
  },
  {
    name: 'Tambaram Outskirts',
    level: 'medium', score: 58,
    center: [12.9249, 80.1000],
    radius: 600,
    reason: 'Sparse population at night',
  },
  {
    name: 'Washermanpet Inner Roads',
    level: 'high', score: 79,
    center: [13.1220, 80.2820],
    radius: 350,
    reason: 'Narrow streets, low visibility',
  },
  {
    name: 'Kodambakkam Canal Area',
    level: 'medium', score: 55,
    center: [13.0520, 80.2240],
    radius: 300,
    reason: 'Isolated stretch near canal',
  },
  {
    name: 'Vyasarpadi',
    level: 'high', score: 71,
    center: [13.1230, 80.2530],
    radius: 450,
    reason: 'Low patrol frequency',
  },
  {
    name: 'Thiruvottiyur Industrial',
    level: 'medium', score: 60,
    center: [13.1600, 80.3000],
    radius: 500,
    reason: 'Industrial zone, empty after hours',
  },
  {
    name: 'Saidapet Bridge Underpass',
    level: 'medium', score: 52,
    center: [13.0220, 80.2230],
    radius: 200,
    reason: 'Dimly lit underpass area',
  },
];

// Safe zones — well-lit, crowded, patrolled
export const SAFE_ZONES = [
  { name: 'T. Nagar Shopping Area', center: [13.0418, 80.2341], radius: 600, score: 15 },
  { name: 'Anna Nagar Main Road', center: [13.0850, 80.2100], radius: 500, score: 12 },
  { name: 'Marina Beach Promenade', center: [13.0500, 80.2824], radius: 400, score: 20 },
  { name: 'Adyar Main Road', center: [13.0063, 80.2574], radius: 400, score: 18 },
  { name: 'Nungambakkam High Road', center: [13.0600, 80.2420], radius: 350, score: 14 },
  { name: 'Velachery Main Road', center: [12.9815, 80.2180], radius: 400, score: 22 },
  { name: 'Mylapore Tank Area', center: [13.0334, 80.2687], radius: 300, score: 16 },
  { name: 'Besant Nagar Beach', center: [13.0002, 80.2710], radius: 350, score: 19 },
  { name: 'Phoenix Mall Area', center: [12.9914, 80.2156], radius: 300, score: 10 },
  { name: 'Central Station Area', center: [13.0830, 80.2750], radius: 250, score: 25 },
];

// Crowd density simulation points [lat, lng, intensity]
export function getCrowdDensity(hour) {
  const isDay = hour >= 7 && hour <= 20;
  const isRush = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19);
  const isLateNight = hour >= 23 || hour <= 5;
  const mult = isRush ? 1.0 : isDay ? 0.6 : isLateNight ? 0.1 : 0.3;

  const points = [
    // Markets & commercial — high density during day
    [13.0418, 80.2341, 0.9 * mult], // T. Nagar
    [13.0600, 80.2420, 0.8 * mult], // Nungambakkam
    [13.0830, 80.2750, 0.85 * mult], // Central
    [13.0850, 80.2100, 0.7 * mult], // Anna Nagar
    [13.0334, 80.2687, 0.65 * mult], // Mylapore
    [12.9914, 80.2156, 0.75 * mult], // Velachery
    // Beaches — evening crowd
    [13.0500, 80.2824, hour >= 16 && hour <= 20 ? 0.8 : 0.3],
    [13.0002, 80.2710, hour >= 16 && hour <= 20 ? 0.7 : 0.2],
    // IT corridor — office hours
    [12.8400, 80.2264, (hour >= 9 && hour <= 18) ? 0.9 : 0.15],
    [12.8700, 80.2200, (hour >= 9 && hour <= 18) ? 0.85 : 0.1],
    // Residential — evening activity
    [13.0063, 80.2574, isDay ? 0.5 : 0.25], // Adyar
    [12.9815, 80.2180, isDay ? 0.55 : 0.2], // Velachery
    // Transport hubs
    [12.9783, 80.1628, isRush ? 0.9 : 0.4], // Tambaram station
    [13.0735, 80.2588, isRush ? 0.85 : 0.4], // Egmore
  ];

  // Add scatter points
  const scatter = [];
  points.forEach(p => {
    scatter.push(p);
    for (let i = 0; i < 5; i++) {
      scatter.push([
        p[0] + (Math.random() - 0.5) * 0.008,
        p[1] + (Math.random() - 0.5) * 0.008,
        p[2] * (0.3 + Math.random() * 0.5),
      ]);
    }
  });
  return scatter;
}

// Community reports (mock)
export const COMMUNITY_REPORTS = [
  { id: 1, type: 'danger', text: 'Street lights not working for 3 days near Royapuram fish market.', location: 'Royapuram', coords: [13.1080, 80.2920], time: '2 hours ago', votes: 12 },
  { id: 2, type: 'warning', text: 'Stray dogs aggressive near Perambur bridge after dark.', location: 'Perambur', coords: [13.1140, 80.2360], time: '5 hours ago', votes: 8 },
  { id: 3, type: 'danger', text: 'Chain snatching reported near Washermanpet metro exit.', location: 'Washermanpet', coords: [13.1210, 80.2810], time: '1 day ago', votes: 23 },
  { id: 4, type: 'warning', text: 'Construction debris blocking walkway, forcing pedestrians onto road.', location: 'Kodambakkam', coords: [13.0530, 80.2250], time: '3 hours ago', votes: 6 },
  { id: 5, type: 'info', text: 'New CCTV cameras installed near Mylapore tank — area feels safer now!', location: 'Mylapore', coords: [13.0340, 80.2680], time: '1 day ago', votes: 31 },
  { id: 6, type: 'danger', text: 'Very dark stretch on Vyasarpadi main road. No street lights.', location: 'Vyasarpadi', coords: [13.1235, 80.2540], time: '6 hours ago', votes: 15 },
  { id: 7, type: 'warning', text: 'Waterlogging makes road slippery near Saidapet underpass.', location: 'Saidapet', coords: [13.0225, 80.2235], time: '12 hours ago', votes: 9 },
  { id: 8, type: 'info', text: 'Police patrol increased around T. Nagar after festival season.', location: 'T. Nagar', coords: [13.0420, 80.2345], time: '2 days ago', votes: 18 },
];
