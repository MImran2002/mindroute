import { Injectable } from '@nestjs/common';

import { SupervisedTrainingDatasetService } from './supervised-training-dataset.service';
import type { TrainingDatasetStats } from './interfaces/training-dataset-stats.interface';

@Injectable()
export class TrainingDatasetStatsService {
  constructor(
    private readonly supervisedTrainingDatasetService: SupervisedTrainingDatasetService,
  ) {}

  async getStats(): Promise<TrainingDatasetStats> {
    const records = await this.supervisedTrainingDatasetService.getRecords();

    const requestIds = new Set(records.map((record) => record.requestId));

    const selectedRecords = records.filter((record) => record.selected === 1);

    const liveEnvironmentalRecords = records.filter(
      (record) =>
        record.environmentalRetrievalSource === 'live' ||
        (record.environmentalRetrievalSource === undefined &&
          record.environmentalDataStatus !== 'fallback'),
    ).length;

    const cachedEnvironmentalRecords = records.filter(
      (record) => record.environmentalRetrievalSource === 'cache',
    ).length;

    const fallbackEnvironmentalRecords = records.filter(
      (record) =>
        record.environmentalRetrievalSource === 'fallback' ||
        (record.environmentalRetrievalSource === undefined &&
          record.environmentalDataStatus === 'fallback'),
    ).length;

    const selectedRankOneCount = selectedRecords.filter(
      (record) => record.rank === 1,
    ).length;

    const selectedNonRankOneCount =
      selectedRecords.length - selectedRankOneCount;

    const recommendationCounts: Record<string, number> = {};

    for (const record of selectedRecords) {
      const label = record.recommendationLabel;

      recommendationCounts[label] = (recommendationCounts[label] ?? 0) + 1;
    }

    const averageCandidatesPerLabeledRequest =
      requestIds.size === 0
        ? 0
        : Number((records.length / requestIds.size).toFixed(2));

    const labeledRequestTarget = 50;

    const labeledRequestProgress = Number(
      Math.min(requestIds.size / labeledRequestTarget, 1).toFixed(2),
    );

    const fallbackEnvironmentalShare =
      records.length === 0
        ? 0
        : Number((fallbackEnvironmentalRecords / records.length).toFixed(4));

    const baselineTrainingReadinessReasons: string[] = [];

    if (requestIds.size < labeledRequestTarget) {
      baselineTrainingReadinessReasons.push(
        `Need at least ${labeledRequestTarget} labeled requests; currently ${requestIds.size}.`,
      );
    }

    if (averageCandidatesPerLabeledRequest < 2) {
      baselineTrainingReadinessReasons.push(
        'Need at least 2 candidate routes per labeled request on average.',
      );
    }

    if (selectedNonRankOneCount < 5) {
      baselineTrainingReadinessReasons.push(
        `Need at least 5 non-rank-one user selections; currently ${selectedNonRankOneCount}.`,
      );
    }

    if (fallbackEnvironmentalShare > 0.5) {
      baselineTrainingReadinessReasons.push(
        `Fallback environmental data is ${(fallbackEnvironmentalShare * 100).toFixed(1)}%; target is 50% or less.`,
      );
    }

    const baselineTrainingReady = baselineTrainingReadinessReasons.length === 0;

    return {
      totalTrainingRecords: records.length,
      totalLabeledRecords: records.length,
      totalLabeledRequests: requestIds.size,

      selectedExamples: selectedRecords.length,
      notSelectedExamples: records.length - selectedRecords.length,

      liveEnvironmentalRecords,
      cachedEnvironmentalRecords,
      fallbackEnvironmentalRecords,

      selectedRankOneCount,
      selectedNonRankOneCount,

      averageCandidatesPerLabeledRequest,

      recommendationCounts,

      baselineTrainingReady,
      baselineTrainingReadinessReasons,

      labeledRequestTarget,
      labeledRequestProgress,

      fallbackEnvironmentalShare,
    };
  }
}
