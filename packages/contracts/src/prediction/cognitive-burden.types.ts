export type CognitiveBurdenLevel = "low" | "moderate" | "high";

export interface CognitiveBurdenPrediction {
  routeId: string;
  score: number;
  level: CognitiveBurdenLevel;
  confidence: number;
  explanation?: string;
}
