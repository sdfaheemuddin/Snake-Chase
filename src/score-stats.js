/** Average earned points per successfully collected food; never divide by zero. */
export function averagePointsPerFood(score, foods) {
  return foods > 0 ? (score / foods).toFixed(1) : '0.0';
}
