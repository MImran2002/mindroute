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

    const fallbackEnvironmentalRecords = records.filter(
      (record) => record.environmentalDataStatus === 'fallback',
    ).length;

    const liveEnvironmentalRecords =
      records.length - fallbackEnvironmentalRecords;

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

    return {
      totalTrainingRecords: records.length,
      totalLabeledRecords: records.length,
      totalLabeledRequests: requestIds.size,

      selectedExamples: selectedRecords.length,
      notSelectedExamples: records.length - selectedRecords.length,

      liveEnvironmentalRecords,
      fallbackEnvironmentalRecords,

      selectedRankOneCount,
      selectedNonRankOneCount,

      averageCandidatesPerLabeledRequest,

      recommendationCounts,
    };
  }
}
