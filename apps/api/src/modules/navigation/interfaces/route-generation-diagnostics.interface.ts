export interface RouteGenerationDiagnostics {
  plansAttempted: number;
  providerSuccesses: number;
  providerFailures: number;
  routesBeforeDeduplication: number;
  routesAfterDeduplication: number;
  duplicatesRemoved: number;

  environmental: {
    sampleCount: number;
    groupCount: number;
    liveGroups: number;
    cacheGroups: number;
    fallbackGroups: number;
    fallbackReasons: string[];
    durationMs: number;
  };
}
