import { Injectable } from '@nestjs/common';

import type { RouteRecommendation } from './interfaces/route-recommendation.interface';
import type { WalkingRoute } from './navigation.service';

@Injectable()
export class RouteRecommendationService {
  assignRecommendations(routes: WalkingRoute[]): WalkingRoute[] {
    if (routes.length === 0) {
      return routes;
    }

    const lowestCognitiveLoad = this.findMinimum(
      routes,
      (route) => route.score.cognitiveLoadScore,
    );

    const mostComfortable = this.findMaximum(
      routes,
      (route) => route.score.comfortScore,
    );

    const fastest = this.findMinimum(routes, (route) => route.durationSeconds);

    return routes.map((route) => {
      const labels: RouteRecommendation['labels'] = [];

      if (route.rank === 1) {
        labels.push('Best overall');
      }

      if (route.id === lowestCognitiveLoad.id) {
        labels.push('Lowest cognitive load');
      }

      if (route.id === mostComfortable.id) {
        labels.push('Most comfortable');
      }

      if (route.id === fastest.id) {
        labels.push('Fastest');
      }

      if (labels.length === 0) {
        labels.push('Alternative');
      }

      return {
        ...route,
        recommendation: {
          primaryLabel: labels[0],
          labels,
          explanation: this.createExplanation(route, labels),
        },
      };
    });
  }

  private createExplanation(
    route: WalkingRoute,
    labels: RouteRecommendation['labels'],
  ): string {
    if (labels.includes('Best overall')) {
      return (
        `Ranked first with a final score of ` + `${route.score.finalScore}.`
      );
    }

    if (labels.includes('Lowest cognitive load')) {
      return (
        `Has the lowest estimated cognitive-load score of ` +
        `${route.score.cognitiveLoadScore}.`
      );
    }

    if (labels.includes('Most comfortable')) {
      return (
        `Has the highest environmental comfort score of ` +
        `${route.score.comfortScore}.`
      );
    }

    if (labels.includes('Fastest')) {
      return (
        `Has the shortest estimated walking duration of ` +
        `${Math.round(route.durationSeconds / 60)} minutes.`
      );
    }

    return 'A viable alternative walking route.';
  }

  private findMinimum(
    routes: WalkingRoute[],
    selector: (route: WalkingRoute) => number,
  ): WalkingRoute {
    return routes.reduce((best, route) =>
      selector(route) < selector(best) ? route : best,
    );
  }

  private findMaximum(
    routes: WalkingRoute[],
    selector: (route: WalkingRoute) => number,
  ): WalkingRoute {
    return routes.reduce((best, route) =>
      selector(route) > selector(best) ? route : best,
    );
  }
}
