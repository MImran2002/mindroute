export interface RouteGenerationDiagnostics {
  plansAttempted: number;
  providerSuccesses: number;
  providerFailures: number;
  routesBeforeDeduplication: number;
  routesAfterDeduplication: number;
  duplicatesRemoved: number;
}
