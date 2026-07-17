export interface UserPreferenceProfile {
  profileVersion: 1;

  timeSensitivity: number;
  turnSensitivity: number;
  decisionPointSensitivity: number;
  crowdSensitivity: number;
  crossingSensitivity: number;
  noiseSensitivity: number;

  maximumDetourPercent: number;
}
