export interface TrainingDatasetStats {
  totalTrainingRecords: number;
  totalLabeledRecords: number;
  totalLabeledRequests: number;

  selectedExamples: number;
  notSelectedExamples: number;

  liveEnvironmentalRecords: number;
  fallbackEnvironmentalRecords: number;

  selectedRankOneCount: number;
  selectedNonRankOneCount: number;

  averageCandidatesPerLabeledRequest: number;

  recommendationCounts: Record<string, number>;
}
