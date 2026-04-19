/**
 * AI Context Builder Utilities
 * Prepares rich context data for the AI assistant
 */

const WEATHER_API_KEY = process.env.NEXT_PUBLIC_WEATHER_API_KEY;

/**
 * Fetch 5-day weather forecast and format for AI context
 */
export async function buildWeatherContext(lat, lon) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || !data.list) return null;

    // Group forecast by day
    const dailyForecasts = {};
    data.list.forEach(item => {
      const date = item.dt_txt.split(' ')[0];
      if (!dailyForecasts[date]) {
        dailyForecasts[date] = [];
      }
      dailyForecasts[date].push({
        time: item.dt_txt.split(' ')[1].slice(0, 5),
        temp: Math.round(item.main.temp),
        feelsLike: Math.round(item.main.feels_like),
        humidity: item.main.humidity,
        weather: item.weather[0].main,
        description: item.weather[0].description,
        windSpeed: item.wind.speed,
        rainChance: item.pop ? Math.round(item.pop * 100) : 0,
        rain: item.rain?.['3h'] || 0,
      });
    });

    return {
      city: data.city?.name || 'Unknown',
      forecasts: dailyForecasts,
      summary: Object.entries(dailyForecasts).map(([date, periods]) => {
        const avgTemp = Math.round(periods.reduce((s, p) => s + p.temp, 0) / periods.length);
        const maxRain = Math.max(...periods.map(p => p.rainChance));
        const conditions = [...new Set(periods.map(p => p.weather))].join(', ');
        return `${date}: ${avgTemp}°C, ${conditions}, ${maxRain}% rain chance`;
      }).join('\n')
    };
  } catch (err) {
    console.error('Weather context fetch failed:', err);
    return null;
  }
}

/**
 * Build a summary of user's events for AI context
 */
export function buildEventsContext(events) {
  if (!events || events.length === 0) {
    return { count: 0, summary: 'No events scheduled.', events: [] };
  }

  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

  const summary = sorted.map(e => {
    return `- ${e.date}: "${e.title}" at ${e.location} (${e.category}, ${e.price || 'no price'})`;
  }).join('\n');

  // Group by date
  const byDate = {};
  sorted.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  return {
    count: events.length,
    summary,
    events: sorted,
    byDate,
    dateRange: {
      start: sorted[0]?.date,
      end: sorted[sorted.length - 1]?.date,
    }
  };
}

/**
 * Detect scheduling conflicts and issues
 */
export function detectScheduleConflicts(events) {
  if (!events || events.length < 2) return [];

  const conflicts = [];
  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Check for same-date events (potential time overlaps)
  const byDate = {};
  sorted.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  Object.entries(byDate).forEach(([date, dayEvents]) => {
    if (dayEvents.length > 3) {
      conflicts.push({
        type: 'overloaded',
        severity: 'warning',
        message: `${date} has ${dayEvents.length} events scheduled — that may be too many for one day.`,
        events: dayEvents.map(e => e.title),
      });
    }

    // Check for duplicate locations on same day
    const locations = dayEvents.map(e => e.location.toLowerCase());
    const uniqueLocations = [...new Set(locations)];
    if (uniqueLocations.length < locations.length) {
      conflicts.push({
        type: 'duplicate_location',
        severity: 'info',
        message: `${date} has multiple events at the same location — consider combining them.`,
        events: dayEvents.map(e => e.title),
      });
    }
  });

  // Check for events on consecutive days at very different locations
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const daysBetween = (new Date(next.date) - new Date(current.date)) / (1000 * 60 * 60 * 24);

    if (daysBetween === 0 && current.location !== next.location) {
      conflicts.push({
        type: 'same_day_different_location',
        severity: 'info',
        message: `"${current.title}" and "${next.title}" are on the same day at different locations (${current.location} → ${next.location}). Make sure travel time is realistic.`,
        events: [current.title, next.title],
      });
    }
  }

  return conflicts;
}

/**
 * Classify weather suitability for outdoor travel
 */
export function getWeatherSuitability(weatherPeriod) {
  if (!weatherPeriod) return { rating: 'unknown', label: 'Unknown', advice: '' };

  const { weather, temp, windSpeed, rainChance } = weatherPeriod;

  if (rainChance > 70 || weather === 'Thunderstorm') {
    return {
      rating: 'poor',
      label: '⛈️ Poor',
      advice: 'Heavy rain or storms expected. Consider indoor activities or rescheduling.',
      color: '#E53E3E'
    };
  }

  if (rainChance > 40 || weather === 'Rain' || weather === 'Drizzle') {
    return {
      rating: 'moderate',
      label: '🌧️ Moderate',
      advice: 'Rain is possible. Bring an umbrella and have a backup plan.',
      color: '#DD6B20'
    };
  }

  if (temp > 38) {
    return {
      rating: 'moderate',
      label: '🌡️ Very Hot',
      advice: 'Extreme heat expected. Stay hydrated, wear sunscreen, and take breaks.',
      color: '#DD6B20'
    };
  }

  if (weather === 'Clear' || weather === 'Clouds') {
    return {
      rating: 'good',
      label: '☀️ Good',
      advice: 'Great conditions for travel and outdoor activities!',
      color: '#38A169'
    };
  }

  return {
    rating: 'moderate',
    label: '🌤️ Fair',
    advice: 'Conditions are acceptable for most activities.',
    color: '#D69E2E'
  };
}

/**
 * Generate packing suggestions based on weather + event categories
 */
export function suggestPackingList(weatherData, events) {
  const items = new Set();

  // Always bring essentials
  items.add('💧 Water bottle');
  items.add('📱 Phone charger / power bank');
  items.add('💳 Wallet / ID');

  if (!weatherData && !events) return [...items];

  // Weather-based items
  if (weatherData?.forecasts) {
    const allPeriods = Object.values(weatherData.forecasts).flat();
    const hasRain = allPeriods.some(p => p.rainChance > 30 || p.weather === 'Rain');
    const isHot = allPeriods.some(p => p.temp > 33);
    const isCold = allPeriods.some(p => p.temp < 22);
    const isWindy = allPeriods.some(p => p.windSpeed > 8);

    if (hasRain) {
      items.add('☂️ Umbrella');
      items.add('🧥 Rain jacket / poncho');
      items.add('👟 Waterproof footwear');
    }
    if (isHot) {
      items.add('🧴 Sunscreen (SPF 50+)');
      items.add('🧢 Hat / cap');
      items.add('🕶️ Sunglasses');
      items.add('🌡️ Cooling towel');
    }
    if (isCold) {
      items.add('🧥 Light jacket');
      items.add('🧣 Scarf');
    }
    if (isWindy) {
      items.add('🧥 Windbreaker');
    }
  }

  // Event-category-based items
  if (events && events.length > 0) {
    const categories = events.map(e => e.category?.toLowerCase());

    if (categories.includes('food')) {
      items.add('💊 Antacid / digestive medicine');
    }
    if (categories.includes('sightseeing')) {
      items.add('📷 Camera');
      items.add('🗺️ Offline map downloaded');
      items.add('👟 Comfortable walking shoes');
    }
    if (categories.includes('hotel')) {
      items.add('🧳 Overnight bag');
      items.add('🪥 Toiletries');
    }
    if (categories.includes('leisure')) {
      items.add('👙 Swimwear (if pool/beach)');
      items.add('🏖️ Towel');
      items.add('🧴 Sunscreen');
    }
  }

  return [...items];
}
