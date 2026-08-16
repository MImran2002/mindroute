export interface TrainingDatasetStats {
  totalTrainingRecords: number;
  totalLabeledRecords: number;
  totalLabeledRequests: number;

  totalTrainableRecords: number;
  totalTrainableRequests: number;
  excludedFromTrainingRecords: number;

  selectedExamples: number;
  notSelectedExamples: number;

  trainableSelectedExamples: number;
  trainableNotSelectedExamples: number;

  liveEnvironmentalRecords: number;
  cachedEnvironmentalRecords: number;
  fallbackEnvironmentalRecords: number;

  selectedRankOneCount: number;
  selectedNonRankOneCount: number;

  averageCandidatesPerLabeledRequest: number;

  recommendationCounts: Record<string, number>;

  baselineTrainingReady: boolean;
  baselineTrainingReadinessReasons: string[];

  labeledRequestTarget: number;
  labeledRequestProgress: number;

  fallbackEnvironmentalShare: number;
}
