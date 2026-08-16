import type { WalkingRoute } from '../navigation.service';
import type { RouteGenerationDiagnostics } from './route-generation-diagnostics.interface';

export interface NavigationRoutesResponse {
  requestId: string;
  routes: WalkingRoute[];
  diagnostics: RouteGenerationDiagnostics;
}
