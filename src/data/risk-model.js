// AI Predictive Risk Analysis Engine
import { DANGER_ZONES, SAFE_ZONES } from './chennai-zones.js';

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getTimeScore(hour) {
  // Higher score = more dangerous. Night hours are riskiest
  if (hour >= 23 || hour < 5) return 95;
  if (hour >= 21) return 75;
  if (hour >= 19) return 50;
  if (hour >= 6 && hour <= 8) return 20;
  if (hour >= 8 && hour <= 18) return 10;
  return 35;
}

function getCrowdScore(hour, lat, lng) {
  const isCommercial = SAFE_ZONES.some(z => haversine(lat, lng, z.center[0], z.center[1]) < z.radius);
  const isDay = hour >= 7 && hour <= 20;
  if (isCommercial && isDay) return 10;
  if (isCommercial && !isDay) return 40;
  if (!isCommercial && isDay) return 45;
  return 85;
}

function getLightingScore(hour, lat, lng) {
  const nearSafe = SAFE_ZONES.some(z => haversine(lat, lng, z.center[0], z.center[1]) < z.radius * 1.2);
  const isNight = hour >= 19 || hour < 6;
  if (!isNight) return 5;
  if (nearSafe) return 30;
  return 75;
}

function getZoneScore(lat, lng) {
  let worst = 0;
  for (const z of DANGER_ZONES) {
    const dist = haversine(lat, lng, z.center[0], z.center[1]);
    if (dist < z.radius) return z.score;
    if (dist < z.radius * 2) worst = Math.max(worst, z.score * 0.5);
  }
  for (const z of SAFE_ZONES) {
    const dist = haversine(lat, lng, z.center[0], z.center[1]);
    if (dist < z.radius) return Math.max(5, worst - 20);
  }
  return worst || 30;
}

function getAreaType(lat, lng) {
  for (const z of DANGER_ZONES) {
    if (haversine(lat, lng, z.center[0], z.center[1]) < z.radius) return { type: 'danger', name: z.name, reason: z.reason };
  }
  for (const z of SAFE_ZONES) {
    if (haversine(lat, lng, z.center[0], z.center[1]) < z.radius) return { type: 'safe', name: z.name, reason: 'Well-lit, crowded area' };
  }
  return { type: 'unknown', name: 'Unclassified Area', reason: 'No community data available' };
}

export function analyzeRisk(lat, lng, hour = null) {
  if (hour === null) hour = new Date().getHours();

  const timeScore = getTimeScore(hour);
  const crowdScore = getCrowdScore(hour, lat, lng);
  const lightScore = getLightingScore(hour, lat, lng);
  const zoneScore = getZoneScore(lat, lng);
  const areaType = getAreaType(lat, lng);

  // Weighted total
  const total = Math.round(
    timeScore * 0.25 +
    crowdScore * 0.25 +
    lightScore * 0.20 +
    zoneScore * 0.20 +
    (areaType.type === 'danger' ? 70 : areaType.type === 'safe' ? 10 : 35) * 0.10
  );

  const riskLevel = total >= 70 ? 'High Risk' : total >= 40 ? 'Moderate' : 'Low Risk';
  const riskColor = total >= 70 ? '#EF4444' : total >= 40 ? '#F59E0B' : '#10B981';

  // Generate hourly prediction
  const predictions = [];
  for (let h = 0; h < 24; h++) {
    const t = getTimeScore(h) * 0.25 + getCrowdScore(h, lat, lng) * 0.25 + getLightingScore(h, lat, lng) * 0.20 + zoneScore * 0.20 + (areaType.type === 'danger' ? 70 : areaType.type === 'safe' ? 10 : 35) * 0.10;
    predictions.push(Math.round(t));
  }

  // Find peak danger time
  const peakHour = predictions.indexOf(Math.max(...predictions));
  const safestHour = predictions.indexOf(Math.min(...predictions));

  return {
    score: Math.min(100, Math.max(0, total)),
    level: riskLevel,
    color: riskColor,
    area: areaType,
    factors: {
      time: { label: 'Time of Day', score: timeScore, detail: `${hour}:00 — ${timeScore > 50 ? 'High risk hours' : 'Lower risk'}` },
      crowd: { label: 'Crowd Density', score: crowdScore, detail: crowdScore > 50 ? 'Low crowd — isolated' : 'Active area' },
      lighting: { label: 'Lighting', score: lightScore, detail: lightScore > 50 ? 'Poorly lit area' : 'Well lit' },
      zone: { label: 'Zone Safety', score: zoneScore, detail: areaType.reason },
    },
    predictions,
    peakDanger: `${peakHour}:00`,
    safestTime: `${safestHour}:00`,
  };
}

export function scoreRoute(routeCoords, hour = null) {
  if (hour === null) hour = new Date().getHours();
  if (!routeCoords || routeCoords.length === 0) return { score: 50, level: 'Unknown' };

  const sampleSize = Math.min(routeCoords.length, 20);
  const step = Math.floor(routeCoords.length / sampleSize);
  let totalRisk = 0;
  let maxRisk = 0;

  for (let i = 0; i < routeCoords.length; i += step) {
    const coord = routeCoords[i];
    const risk = analyzeRisk(coord.lat, coord.lng, hour);
    totalRisk += risk.score;
    maxRisk = Math.max(maxRisk, risk.score);
  }

  const avgRisk = totalRisk / sampleSize;
  const safetyScore = Math.round(100 - (avgRisk * 0.7 + maxRisk * 0.3));

  return {
    score: Math.max(0, Math.min(100, safetyScore)),
    level: safetyScore >= 70 ? 'Safe' : safetyScore >= 40 ? 'Moderate' : 'Unsafe',
    color: safetyScore >= 70 ? '#10B981' : safetyScore >= 40 ? '#F59E0B' : '#EF4444',
    avgRisk: Math.round(avgRisk),
    maxRisk: Math.round(maxRisk),
  };
}
