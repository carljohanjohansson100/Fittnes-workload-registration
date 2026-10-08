'use strict';

// Approximativa MET-värden (i linje med Compendium of Physical Activities).
// Kalorier = MET × vikt (kg) × tid (timmar). Skattning, inte mätning.
const Calories = {
  met(type, minutes, km, hr) {
    const kmh = km > 0 && minutes > 0 ? km / (minutes / 60) : null;
    const pick = (table, v) => table.find(([max]) => v <= max)[1];
    const INF = Infinity;
    switch (type) {
      case 'promenad':
        return kmh === null ? 3.5 : pick([[3.2, 2.8], [4.8, 3.5], [5.6, 4.3], [INF, 5.0]], kmh);
      case 'löpning':
        return kmh === null ? 9.8 : pick([[8, 8.3], [9.7, 9.8], [11.3, 11.0], [12.9, 11.8], [14.5, 12.8], [16, 14.5], [INF, 16.0]], kmh);
      case 'cykling':
        return kmh === null ? 6.8 : pick([[16, 4.0], [19.3, 6.8], [22.5, 8.0], [25.7, 10.0], [INF, 12.0]], kmh);
      case 'simning':
        return kmh === null ? 7.0 : pick([[1.5, 5.8], [2.5, 7.0], [INF, 9.8]], kmh);
      case 'gym':
      default:
        if (!hr) return 5.0;
        return hr < 120 ? 3.5 : hr < 140 ? 5.0 : hr < 160 ? 6.0 : 8.0;
    }
  },

  kcal(type, minutes, km, hr, weightKg) {
    return Math.round(this.met(type, minutes, km, hr) * weightKg * (minutes / 60));
  },
};
