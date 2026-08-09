import type { AITrainingRecord } from './ai-training-record.interface';

export interface SupervisedTrainingRecord extends AITrainingRecord {
  selected: 0 | 1;
  selectedAt: string;
  targetSource: 'user-choice';
}
