import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const API_BASE = 'http://localhost:3001/api';

const presets = [
  {
    name: 'Mission → North Beach',
    originLat: 37.7749,
    originLng: -122.4194,
    destinationLat: 37.7989,
    destinationLng: -122.4075,
  },
  {
    name: 'Golden Gate Park → Marina',
    originLat: 37.7694,
    originLng: -122.4862,
    destinationLat: 37.8078,
    destinationLng: -122.4376,
  },
  {
    name: 'SoMa → Chinatown',
    originLat: 37.7786,
    originLng: -122.4056,
    destinationLat: 37.7941,
    destinationLng: -122.4078,
  },
  {
    name: 'Castro → Civic Center',
    originLat: 37.7609,
    originLng: -122.435,
    destinationLat: 37.7793,
    destinationLng: -122.4192,
  },
  {
    name: 'Haight → Union Square',
    originLat: 37.7692,
    originLng: -122.4481,
    destinationLat: 37.7879,
    destinationLng: -122.4075,
  },
  {
    name: 'Embarcadero → Fisherman’s Wharf',
    originLat: 37.7955,
    originLng: -122.3937,
    destinationLat: 37.808,
    destinationLng: -122.4177,
  },
  {
    name: 'Mission Bay → Ferry Building',
    originLat: 37.77,
    originLng: -122.3875,
    destinationLat: 37.7955,
    destinationLng: -122.3937,
  },
  {
    name: 'Noe Valley → Dolores Park',
    originLat: 37.7502,
    originLng: -122.4337,
    destinationLat: 37.7596,
    destinationLng: -122.4269,
  },
];

const rl = readline.createInterface({
  input,
  output,
});

async function askNumber(label) {
  while (true) {
    const value = await rl.question(label);
    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }

    console.log('Please enter a valid number.');
  }
}

async function chooseTrip() {
  console.log('\nAvailable preset trips:\n');

  presets.forEach((preset, index) => {
    console.log(`${index + 1}. ${preset.name}`);
  });

  console.log(`${presets.length + 1}. Enter coordinates manually`);

  while (true) {
    const answer = await rl.question(
      `\nChoose trip 1-${presets.length + 1}: `,
    );

    const index = Number(answer) - 1;

    if (
      Number.isInteger(index) &&
      index >= 0 &&
      index < presets.length
    ) {
      return presets[index];
    }

    if (index === presets.length) {
      return {
        name: 'Manual trip',
        originLat: await askNumber('Origin latitude: '),
        originLng: await askNumber('Origin longitude: '),
        destinationLat: await askNumber(
          'Destination latitude: ',
        ),
        destinationLng: await askNumber(
          'Destination longitude: ',
        ),
      };
    }

    console.log('Invalid selection.');
  }
}

async function collectChoice() {
  const trip = await chooseTrip();

  console.log(`\nSelected trip: ${trip.name}`);

  const params = new URLSearchParams({
    originLat: String(trip.originLat),
    originLng: String(trip.originLng),
    destinationLat: String(trip.destinationLat),
    destinationLng: String(trip.destinationLng),
  });

  console.log('\nGenerating routes...\n');

  const response = await fetch(
    `${API_BASE}/navigation/routes?${params}`,
  );

  if (!response.ok) {
    throw new Error(
      `Route request failed: ${response.status} ${response.statusText}`,
    );
  }

  const result = await response.json();
  const routes = result.routes ?? [];

  if (routes.length === 0) {
    console.log('No routes returned.');
    return;
  }

  const requestId =
    result.requestId ??
    routes[0]?.trainingRecord?.requestId;

  if (!requestId) {
    throw new Error(
      'Could not find requestId in navigation response.',
    );
  }

  console.log(`Request: ${requestId}\n`);

  routes.forEach((route, index) => {
    const record = route.trainingRecord;

    console.log(`Option ${index + 1}`);
    console.log(`  Route ID:       ${record.routeId}`);
    console.log(`  Source:         ${record.candidateSource}`);
    console.log(`  Rank:           ${record.rank}`);
    console.log(
      `  Distance:       ${Math.round(record.distanceMeters)} m`,
    );
    console.log(
      `  Duration:       ${Math.round(record.durationSeconds / 60)} min`,
    );
    console.log(
      `  Cognitive load: ${record.baselineCognitiveLoadScore}`,
    );
    console.log(
      `  Comfort:        ${record.baselineComfortScore}`,
    );
    console.log(
      `  Final score:    ${record.baselineFinalScore}`,
    );
    console.log(
      `  Recommendation: ${record.recommendationLabel}`,
    );
    console.log(
      `  Environment:    ${record.environmentalRetrievalSource ?? record.environmentalDataStatus}`,
    );
    console.log(
      `  Confidence:     ${Math.round(record.dataConfidence * 100)}%`,
    );

    const candidatePassesQuality =
      record.environmentalDataStatus !== 'fallback' &&
      record.environmentalRetrievalSource !== 'fallback' &&
      record.dataConfidence >= 0.5;

    console.log(
      `  Data quality:   ${candidatePassesQuality ? 'PASS' : 'FAIL'}`,
    );

    if (!candidatePassesQuality) {
      console.log(
        '  Warning:        This candidate does not meet the ML quality threshold.',
      );
    }

    console.log('');
  });

  if (routes.length < 2) {
    console.log(
      'Only one route candidate was generated.',
    );
    console.log(
      'Skipping selection because it is not useful preference data.',
    );
    return;
  }

  const requestIsTrainable =
    routes.length >= 2 &&
    routes.every((route) => {
      const record = route.trainingRecord;

      return (
        record &&
        record.environmentalDataStatus !== 'fallback' &&
        record.environmentalRetrievalSource !== 'fallback' &&
        record.dataConfidence >= 0.5
      );
    });

  console.log(
    `Request trainable: ${requestIsTrainable ? 'YES' : 'NO'}`,
  );

  if (!requestIsTrainable) {
    console.log(
      'This choice will still be saved, but this request will be excluded from the clean ML dataset.',
    );
  }

  console.log('');

  let selectedIndex;

  while (true) {
    const answer = await rl.question(
      `Choose route 1-${routes.length}: `,
    );

    selectedIndex = Number(answer) - 1;

    if (
      Number.isInteger(selectedIndex) &&
      selectedIndex >= 0 &&
      selectedIndex < routes.length
    ) {
      break;
    }

    console.log('Invalid route selection.');
  }

  const selectedRoute = routes[selectedIndex];

  const selectionResponse = await fetch(
    `${API_BASE}/navigation/route-selections`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId,
        routeId:
          selectedRoute.trainingRecord.routeId,
      }),
    },
  );

  const selectionResult =
    await selectionResponse.json();

  if (!selectionResponse.ok) {
    throw new Error(
      `Selection failed: ${JSON.stringify(selectionResult)}`,
    );
  }

  console.log(
    `\nSaved choice: ${selectedRoute.trainingRecord.routeId}`,
  );
  console.log(`Request: ${requestId}`);
}

async function main() {
  console.log('\nMindRoute route-choice collector');

  while (true) {
    await collectChoice();

    const again = await rl.question(
      '\nCollect another route choice? (y/n): ',
    );

    if (again.trim().toLowerCase() !== 'y') {
      break;
    }
  }
}

main()
  .catch((error) => {
    console.error('\nError:', error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
  });
