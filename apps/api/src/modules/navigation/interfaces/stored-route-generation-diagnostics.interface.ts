import type { RouteCandidateSource } from './candidate-route.interface';
import type { RouteGenerationDiagnostics } from './route-generation-diagnostics.interface';

export interface StoredRouteGenerationDiagnostics
  extends RouteGenerationDiagnostics {
  requestId: string;
  capturedAt: string;
  survivingCandidateSources: RouteCandidateSource[];
}
