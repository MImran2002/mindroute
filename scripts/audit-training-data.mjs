const API_BASE =
  process.env.MINDROUTE_API_URL ?? 'http://localhost:3001/api';

const CURRENT_SCHEMA = '2.0';

const response = await fetch(
  `${API_BASE}/navigation/trainable-records`,
);

if (!response.ok) {
  throw new Error(
    `Unable to load trainable records: HTTP ${response.status}`,
  );
}

const allRecords = await response.json();

const records = allRecords.filter(
  (record) => record.schemaVersion === CURRENT_SCHEMA,
);

const features = [
  'estimatedShadeExposure',
  'greeneryExposure',
  'parkExposure',
  'pedestrianDensity',
  'trafficExposure',
  'noiseExposure',
  'commercialActivityExposure',
  'constructionExposure',
  'eventExposure',
  'pointOfInterestDensity',
  'crossingComplexity',
];

console.log('\nMindRoute training-data audit\n');
console.log(`Current schema: ${CURRENT_SCHEMA}`);
console.log(`Trainable rows: ${records.length}`);

const requestIds = new Set(
  records.map((record) => record.requestId),
);

console.log(`Trainable requests: ${requestIds.size}`);

if (records.length === 0) {
  console.log(
    '\nNo current-schema trainable records available yet.',
  );
  process.exit(0);
}

for (const feature of features) {
  const values = records
    .map((record) => Number(record[feature]))
    .filter(Number.isFinite);

  if (values.length === 0) {
    console.log(`\n${feature}`);
    console.log('  No numeric values found.');
    continue;
  }

  const zeroCount = values.filter(
    (value) => value === 0,
  ).length;

  const oneCount = values.filter(
    (value) => value === 1,
  ).length;

  const uniqueValues = new Set(
    values.map((value) => value.toFixed(4)),
  ).size;

  const min = Math.min(...values);
  const max = Math.max(...values);

  const average =
    values.reduce((sum, value) => sum + value, 0) /
    values.length;

  console.log(`\n${feature}`);
  console.log(`  Min:       ${min.toFixed(3)}`);
  console.log(`  Max:       ${max.toFixed(3)}`);
  console.log(`  Average:   ${average.toFixed(3)}`);
  console.log(`  Unique:    ${uniqueValues}`);
  console.log(
    `  Zero:      ${zeroCount}/${values.length} (${(
      (zeroCount / values.length) *
      100
    ).toFixed(1)}%)`,
  );
  console.log(
    `  One:       ${oneCount}/${values.length} (${(
      (oneCount / values.length) *
      100
    ).toFixed(1)}%)`,
  );

  if (uniqueValues === 1) {
    console.log(
      '  WARNING:   Feature has no variation.',
    );
  } else if (
    zeroCount / values.length >= 0.8
  ) {
    console.log(
      '  WARNING:   Feature is zero in at least 80% of rows.',
    );
  } else if (
    oneCount / values.length >= 0.8
  ) {
    console.log(
      '  WARNING:   Feature is saturated at 1 in at least 80% of rows.',
    );
  }
}
