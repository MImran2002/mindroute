import type { WalkingRoute } from '../navigation.service';
import type { RouteGenerationDiagnostics } from './route-generation-diagnostics.interface';

export interface NavigationRoutesResponse {
  routes: WalkingRoute[];
  diagnostics: RouteGenerationDiagnostics;
}
