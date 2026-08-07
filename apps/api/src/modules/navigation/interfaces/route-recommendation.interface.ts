export type RouteRecommendationLabel =
  | 'Best overall'
  | 'Lowest cognitive load'
  | 'Most comfortable'
  | 'Fastest'
  | 'Alternative';

export interface RouteRecommendation {
  primaryLabel: RouteRecommendationLabel;
  labels: RouteRecommendationLabel[];
  explanation: string;
}
