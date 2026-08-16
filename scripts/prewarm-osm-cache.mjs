const API_BASE =
  process.env.MINDROUTE_API_URL ?? 'http://localhost:3001/api';

const trips = [
  {
    name: 'Mission → North Beach',
    origin: [37.7599, -122.4148],
    destination: [37.8061, -122.4103],
  },
  {
    name: 'Golden Gate Park → Marina',
    origin: [37.7694, -122.4862],
    destination: [37.8078, -122.4376],
  },
  {
    name: 'SoMa → Chinatown',
    origin: [37.7749, -122.4194],
    destination: [37.7989, -122.4075],
  },
  {
    name: 'Castro → Civic Center',
    origin: [37.7609, -122.4350],
    destination: [37.7793, -122.4192],
  },
  {
    name: 'Haight → Union Square',
    origin: [37.7692, -122.4481],
    destination: [37.7879, -122.4074],
  },
  {
    name: 'Embarcadero → Fisherman’s Wharf',
    origin: [37.7955, -122.3937],
    destination: [37.8080, -122.4177],
  },
  {
    name: 'Mission Bay → Ferry Building',
    origin: [37.7700, -122.3875],
    destination: [37.7955, -122.3937],
  },
  {
    name: 'Noe Valley → Dolores Park',
    origin: [37.7502, -122.4337],
    destination: [37.7596, -122.4269],
  },
];

async function prewarmTrip(trip) {
  const params = new URLSearchParams({
    originLat: String(trip.origin[0]),
    originLng: String(trip.origin[1]),
    destinationLat: String(trip.destination[0]),
    destinationLng: String(trip.destination[1]),
  });

  console.log(`\nPrewarming: ${trip.name}`);

  try {
    const startedAt = Date.now();

    const response = await fetch(
      `${API_BASE}/navigation/routes?${params}`,
    );

    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      console.log(
        `  FAILED: HTTP ${response.status} after ${durationMs}ms`,
      );
      return;
    }

    const result = await response.json();

    const diagnostics = result.diagnostics?.environmental;

    console.log(`  Request: ${result.requestId}`);
    console.log(`  Routes: ${result.routes?.length ?? 0}`);
    console.log(`  Duration: ${durationMs}ms`);

    if (diagnostics) {
      console.log(`  Groups: ${diagnostics.groupCount}`);
      console.log(`  Live: ${diagnostics.liveGroups}`);
      console.log(`  Cache: ${diagnostics.cacheGroups}`);
      console.log(`  Fallback: ${diagnostics.fallbackGroups}`);
    }
  } catch (error) {
    console.log(
      `  ERROR: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }
}

console.log('\nMindRoute OSM cache prewarmer');

for (const trip of trips) {
  await prewarmTrip(trip);

  // Give public Overpass instances a short break
  // between separate route requests.
  await new Promise((resolve) =>
    setTimeout(resolve, 12000),
  );
}

console.log('\nPrewarm pass complete.');
