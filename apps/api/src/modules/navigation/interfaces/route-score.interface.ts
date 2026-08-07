export interface RouteScoreBreakdown {
  navigationComplexity: number;
  crossingComplexity: number;
  environmentalStrain: number;
  routeEfficiency: number;
  environmentalComfort: number;
}

export interface RouteScore {
  cognitiveLoadScore: number;
  comfortScore: number;
  finalScore: number;
  breakdown: RouteScoreBreakdown;
  scoringMethod: 'rule-based-v1';
}
