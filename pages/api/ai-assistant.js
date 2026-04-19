/**
 * AI Assistant API Route
 * POST /api/ai-assistant
 * 
 * Receives user messages + context (events, weather, location)
 * and calls Google Gemini API to generate smart travel responses.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

const SYSTEM_PROMPT = `You are SkyBot, the AI travel assistant for ScheduleSkies — a smart travel planning app focused on Cebu, Philippines.

Your capabilities:
1. **Place Suggestions**: Recommend restaurants, hotels, attractions, events in Cebu and nearby areas. Include estimated prices in PHP (₱).
2. **Weather-Aware Planning**: Analyze weather forecasts and suggest rescheduling outdoor activities if bad weather is expected. Recommend indoor alternatives.
3. **Itinerary Optimization**: Review daily/multi-day itineraries. Detect conflicts (overlapping events, unrealistic travel times). Suggest better ordering based on location proximity and timing.
4. **Route & Travel Advice**: Suggest best routes, warn about traffic during peak hours (7-9 AM, 5-7 PM on weekdays in Cebu).
5. **Packing Suggestions**: Based on weather forecast and planned activities, suggest what to bring.
6. **Safety Alerts**: Warn about extreme weather, high heat index, typhoon advisories.

Personality:
- Friendly, concise, and helpful
- Use emoji sparingly for visual clarity
- Give specific, actionable suggestions
- Always consider the Philippine/Cebu context (peso prices, local landmarks, tropical weather)
- When suggesting schedule changes, explain WHY

Formatting rules:
- Use short paragraphs and bullet points
- Bold important recommendations
- Keep responses under 300 words unless the user asks for detailed analysis
- When suggesting places, include: Name, Type, Estimated Cost, Why it's good

If the user provides their events or weather data, ALWAYS reference it in your response. Don't give generic answers when you have specific context.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GEMINI_API_KEY) {
    // Fallback: provide a helpful response without the API
    return res.status(200).json({
      reply: getFallbackResponse(req.body.message, req.body.context),
      suggestions: getQuickSuggestions(req.body.message),
      source: 'fallback'
    });
  }

  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build context-enriched prompt
    let contextPrompt = '';
    
    if (context?.events?.length > 0) {
      contextPrompt += `\n\n📅 USER'S SCHEDULED EVENTS:\n`;
      context.events.forEach(e => {
        contextPrompt += `- ${e.date}: "${e.title}" at ${e.location} (${e.category}, ${e.price || 'N/A'})\n`;
      });
    }

    if (context?.weather) {
      contextPrompt += `\n\n🌤️ WEATHER FORECAST (${context.weather.city || 'Cebu'}):\n${context.weather.summary || 'No forecast available'}`;
    }

    if (context?.location) {
      contextPrompt += `\n\n📍 USER'S CURRENT LOCATION: ${context.location}`;
    }

    if (context?.conflicts?.length > 0) {
      contextPrompt += `\n\n⚠️ DETECTED SCHEDULE CONFLICTS:\n`;
      context.conflicts.forEach(c => {
        contextPrompt += `- [${c.severity.toUpperCase()}] ${c.message}\n`;
      });
    }

    if (context?.currentWeather) {
      contextPrompt += `\n\n🌡️ CURRENT WEATHER: ${context.currentWeather.temp}°C, ${context.currentWeather.description} in ${context.currentWeather.city}`;
    }

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: message + contextPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.text();
      console.error('Gemini API error:', errorData);
      // Fall back to local response
      return res.status(200).json({
        reply: getFallbackResponse(message, context),
        suggestions: getQuickSuggestions(message),
        source: 'fallback'
      });
    }

    const geminiData = await geminiResponse.json();
    const aiReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text 
      || 'Sorry, I couldn\'t generate a response. Please try again.';

    return res.status(200).json({
      reply: aiReply,
      suggestions: getQuickSuggestions(message),
      source: 'gemini'
    });

  } catch (error) {
    console.error('AI Assistant error:', error);
    return res.status(200).json({
      reply: getFallbackResponse(req.body?.message, req.body?.context),
      suggestions: getQuickSuggestions(req.body?.message),
      source: 'fallback'
    });
  }
}

/**
 * Fallback responses when Gemini API is unavailable
 */
function getFallbackResponse(message, context) {
  const msg = (message || '').toLowerCase();

  if (msg.includes('pack') || msg.includes('bring')) {
    let response = '🎒 **Here\'s what I recommend bringing:**\n\n';
    response += '**Essentials:**\n';
    response += '- 💧 Water bottle (stay hydrated!)\n';
    response += '- 📱 Phone charger / power bank\n';
    response += '- 💳 Wallet & ID\n\n';
    
    response += '**For Cebu\'s tropical weather:**\n';
    response += '- ☂️ Umbrella (rain is common)\n';
    response += '- 🧴 Sunscreen SPF 50+\n';
    response += '- 🧢 Hat or cap\n';
    response += '- 🕶️ Sunglasses\n';
    response += '- 👟 Comfortable walking shoes\n';

    if (context?.events?.some(e => e.category === 'Leisure')) {
      response += '\n**For your leisure activities:**\n';
      response += '- 👙 Swimwear\n';
      response += '- 🏖️ Towel\n';
    }
    return response;
  }

  if (msg.includes('conflict') || msg.includes('overlap') || msg.includes('check')) {
    if (context?.conflicts?.length > 0) {
      let response = '⚠️ **Schedule Issues Detected:**\n\n';
      context.conflicts.forEach(c => {
        const icon = c.severity === 'warning' ? '🟡' : 'ℹ️';
        response += `${icon} ${c.message}\n\n`;
      });
      response += '💡 **Tip:** Try spacing out your events and grouping nearby locations on the same day.';
      return response;
    }
    return '✅ **No conflicts detected!** Your schedule looks good. All events are well-spaced.';
  }

  if (msg.includes('weather') || msg.includes('rain') || msg.includes('forecast')) {
    if (context?.weather?.summary) {
      return `🌤️ **Weather Forecast for ${context.weather.city || 'Cebu'}:**\n\n${context.weather.summary}\n\n💡 **Tip:** If rain is expected (>40%), consider having indoor backup plans like visiting SM Seaside, Ayala Center, or IT Park restaurants.`;
    }
    return '🌤️ **Cebu Weather Tips:**\n\n' +
      '- Dry season: January to May (best for travel)\n' +
      '- Wet season: June to December\n' +
      '- Average temperature: 27-33°C\n' +
      '- Always bring an umbrella — tropical showers are common!\n\n' +
      '💡 Open the app\'s weather panel to see your real-time forecast.';
  }

  if (msg.includes('restaurant') || msg.includes('food') || msg.includes('eat')) {
    return '🍽️ **Top Restaurant Picks in Cebu:**\n\n' +
      '1. **Lantaw Native Restaurant** — Filipino cuisine with sea views (₱300-600/person)\n' +
      '2. **House of Lechon** — Famous Cebu lechon (₱250-500/person)\n' +
      '3. **Anzani Mediterranean** — Fine dining (₱800-1,500/person)\n' +
      '4. **STK ta Bai!** — Local grilled seafood (₱150-350/person)\n' +
      '5. **Abaca Baking Company** — Café & pastries (₱200-400/person)\n\n' +
      '💡 Use the Map page to find restaurants along your route!';
  }

  if (msg.includes('place') || msg.includes('visit') || msg.includes('attraction') || msg.includes('suggest')) {
    return '📍 **Must-Visit Places in Cebu:**\n\n' +
      '1. **Kawasan Falls** — Multi-tiered waterfall, great for canyoneering (₱45 entrance)\n' +
      '2. **Temple of Leah** — Roman-inspired temple with city views (₱100 entrance)\n' +
      '3. **Magellan\'s Cross** — Historic landmark in downtown (Free)\n' +
      '4. **Sirao Flower Garden** — The "Little Amsterdam" of Cebu (₱100 entrance)\n' +
      '5. **Tops Lookout** — Panoramic city views, great at sunset (₱100 entrance)\n\n' +
      '💡 Check weather before visiting outdoor spots! I can help plan the best day.';
  }

  if (msg.includes('hotel') || msg.includes('stay') || msg.includes('accommodation')) {
    return '🏨 **Recommended Hotels in Cebu:**\n\n' +
      '**Budget (₱1,000-2,500/night):**\n' +
      '- Red Planet Cebu — Clean, central location\n' +
      '- Go Hotels — Budget-friendly, near malls\n\n' +
      '**Mid-Range (₱3,000-6,000/night):**\n' +
      '- Quest Hotel — IT Park location, modern\n' +
      '- Seda Ayala Center — Connected to Ayala Mall\n\n' +
      '**Luxury (₱7,000+/night):**\n' +
      '- Radisson Blu — Beachfront resort\n' +
      '- Marco Polo Plaza — Hilltop with city views';
  }

  if (msg.includes('optimize') || msg.includes('itinerary') || msg.includes('plan')) {
    if (context?.events?.length > 0) {
      return `📋 **Itinerary Analysis (${context.events.length} events):**\n\n` +
        '**General Tips:**\n' +
        '- Group events by area to minimize travel time\n' +
        '- Schedule outdoor activities in the morning (before peak heat at 12-3 PM)\n' +
        '- Allow 30-60 min buffer between events for Cebu traffic\n' +
        '- Keep food events near other activities to save transit time\n\n' +
        '💡 I can give more specific advice if you tell me the times for each event!';
    }
    return '📋 **Itinerary Planning Tips:**\n\n' +
      '- Start your day early (7-8 AM) to beat the heat\n' +
      '- Group nearby destinations together\n' +
      '- Allow for Cebu traffic (especially on weekdays)\n' +
      '- Have a rainy-day backup plan\n' +
      '- Don\'t over-schedule — 3-4 activities per day is ideal\n\n' +
      '💡 Add events on the Plan page and I can analyze your itinerary!';
  }

  if (msg.includes('route') || msg.includes('traffic') || msg.includes('drive')) {
    return '🚗 **Cebu Traffic Tips:**\n\n' +
      '**Peak Hours (Heavy Traffic):**\n' +
      '- 🔴 7:00-9:00 AM (weekdays)\n' + 
      '- 🔴 5:00-7:00 PM (weekdays)\n\n' +
      '**Best Travel Times:**\n' +
      '- 🟢 9:30 AM - 11:30 AM\n' +
      '- 🟢 1:30 PM - 4:30 PM\n' +
      '- 🟢 After 8:00 PM\n\n' +
      '**Known Congestion Areas:**\n' +
      '- Colon St / Carbon Market area\n' +
      '- Mango Ave / Fuente Osmeña\n' +
      '- SRP / Talisay border\n\n' +
      '💡 Use the Map page to check live route conditions!';
  }

  // Default response
  return '👋 **Hi! I\'m SkyBot, your ScheduleSkies travel assistant!**\n\n' +
    'I can help you with:\n' +
    '- 📍 **Place suggestions** — restaurants, hotels, attractions\n' +
    '- 🌦️ **Weather planning** — check forecasts, get rain alerts\n' +
    '- 📋 **Itinerary optimization** — fix conflicts, reorder events\n' +
    '- 🎒 **Packing lists** — what to bring based on weather & activities\n' +
    '- 🚗 **Route advice** — best travel times, traffic tips\n\n' +
    'Try asking me something like:\n' +
    '- *"What should I bring for my trip?"*\n' +
    '- *"Suggest restaurants in Cebu"*\n' +
    '- *"Check my itinerary for conflicts"*';
}

/**
 * Generate quick suggestion chips based on conversation context
 */
function getQuickSuggestions(message) {
  const msg = (message || '').toLowerCase();

  if (msg.includes('weather') || msg.includes('rain')) {
    return ['What should I bring?', 'Indoor alternatives', 'Best travel days'];
  }
  if (msg.includes('food') || msg.includes('restaurant')) {
    return ['Budget options', 'Fine dining', 'Near Ayala Center'];
  }
  if (msg.includes('conflict') || msg.includes('check')) {
    return ['Optimize itinerary', 'Weather forecast', 'Suggest places'];
  }
  if (msg.includes('itinerary') || msg.includes('optimize')) {
    return ['Check for conflicts', 'Weather for my trips', 'What to bring?'];
  }

  // Default suggestions
  return ['Plan my day', 'Weather check', 'Suggest places', 'What to bring?'];
}
