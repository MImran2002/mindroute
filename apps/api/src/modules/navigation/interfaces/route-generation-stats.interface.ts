export interface RouteGenerationStats {
  totalRequests: number;

  averagePlansAttempted: number;
  averageProviderSuccesses: number;
  averageRoutesAfterDeduplication: number;

  requestsWithOneRoute: number;
  requestsWithTwoRoutes: number;
  requestsWithThreeRoutes: number;

  providerFailureRate: number;
  duplicateRemovalRate: number;

  candidateSourceSurvivalCounts: Record<string, number>;
}
