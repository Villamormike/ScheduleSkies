import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { buildWeatherContext, buildEventsContext, detectScheduleConflicts, suggestPackingList } from '@/lib/aiContext';
import { getLocationWithFallback } from '@/lib/getLocation';
import styles from '../styles/ai-assistant.module.css';

const WELCOME_ACTIONS = [
  { icon: '🗓️', label: 'Optimize my itinerary', message: 'Optimize my itinerary and check for any scheduling issues' },
  { icon: '🌦️', label: 'Weather check for my trips', message: 'Check the weather forecast for my upcoming trips and suggest adjustments' },
  { icon: '🎒', label: 'What should I bring?', message: 'What should I pack and bring for my upcoming trips?' },
  { icon: '📍', label: 'Suggest places to visit', message: 'Suggest the best places to visit in Cebu' },
  { icon: '⚠️', label: 'Check for conflicts', message: 'Check my schedule for any conflicts or overlapping events' },
];

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(['Plan my day', 'Weather check', 'Suggest places', 'What to bring?']);
  const [userEvents, setUserEvents] = useState([]);
  const [weatherContext, setWeatherContext] = useState(null);
  const [userLocation, setUserLocation] = useState('Cebu City');
  const [currentWeather, setCurrentWeather] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch user events and weather on mount
  useEffect(() => {
    const loadContext = async () => {
      try {
        // Fetch events
        const { data: events } = await supabase.from('events').select('*').order('date', { ascending: true });
        if (events) setUserEvents(events);

        // Fetch weather
        const { lat, lon } = await getLocationWithFallback();
        const weatherCtx = await buildWeatherContext(lat, lon);
        if (weatherCtx) {
          setWeatherContext(weatherCtx);
          setUserLocation(weatherCtx.city || 'Cebu City');
        }

        // Current weather
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.NEXT_PUBLIC_WEATHER_API_KEY}`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();
        if (weatherData?.main) {
          setCurrentWeather({
            temp: Math.round(weatherData.main.temp),
            description: weatherData.weather?.[0]?.description || 'Clear',
            city: weatherData.name || 'Cebu City',
          });
        }
      } catch (err) {
        console.error('Failed to load AI context:', err);
      }
    };
    loadContext();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMsg = {
      role: 'user',
      content: text.trim(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Build context
      const eventsCtx = buildEventsContext(userEvents);
      const conflicts = detectScheduleConflicts(userEvents);

      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          context: {
            events: userEvents,
            weather: weatherContext,
            location: userLocation,
            conflicts,
            currentWeather,
          },
        }),
      });

      const data = await response.json();

      const aiMsg = {
        role: 'ai',
        content: data.reply || 'Sorry, I couldn\'t process that. Please try again.',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        source: data.source,
      };

      setMessages(prev => [...prev, aiMsg]);

      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('AI request failed:', err);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: '⚠️ Sorry, I\'m having trouble connecting right now. Please try again in a moment.',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      }]);
    }

    setIsLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const handleSuggestionClick = (text) => {
    sendMessage(text);
  };

  const handleWelcomeAction = (action) => {
    sendMessage(action.message);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  // Format AI message content (basic markdown-like formatting)
  const formatContent = (content) => {
    if (!content) return '';
    
    return content
      .split('\n')
      .map((line, i) => {
        // Bold text
        let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic text
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return `<div key="${i}" style="margin-bottom: ${line === '' ? '8px' : '2px'}">${formatted || '&nbsp;'}</div>`;
      })
      .join('');
  };

  // Floating button (when chat is closed)
  if (!isOpen) {
    return (
      <button
        className={styles.floatingBtn}
        onClick={() => setIsOpen(true)}
        title="Open AI Assistant"
        id="ai-assistant-toggle"
      >
        ✨
      </button>
    );
  }

  // Chat panel (when open)
  return (
    <div className={styles.chatPanel} id="ai-assistant-panel">
      {/* Header */}
      <div className={styles.chatHeader}>
        <div className={styles.chatBrand}>
          <div className={styles.chatBrandIcon}>✨</div>
          <div className={styles.chatBrandText}>
            <h3>SkyBot</h3>
            <div className={styles.chatBrandTextOnline}>
              <span className={styles.onlineDot}></span>
              <span>Travel Assistant</span>
            </div>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={() => setIsOpen(false)} title="Close">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messagesArea}>
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className={styles.welcomeCard}>
            <span className={styles.welcomeIcon}>🌤️</span>
            <h4>Hi! I&apos;m SkyBot</h4>
            <p>
              Your AI travel assistant for ScheduleSkies. I can help with itinerary planning,
              weather checks, place suggestions, and more!
            </p>
            <div className={styles.welcomeActions}>
              {WELCOME_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  className={styles.welcomeActionBtn}
                  onClick={() => handleWelcomeAction(action)}
                >
                  <span className={styles.welcomeActionIcon}>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat Messages */
          messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.messageBubble} ${msg.role === 'user' ? styles.userMessage : styles.aiMessage}`}
            >
              <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
              <div className={styles.messageTime}>
                {msg.time}
                {msg.source && (
                  <span className={styles.sourceBadge} style={{ marginLeft: '6px' }}>
                    {msg.source === 'gemini' ? '✨ AI' : '📋 Local'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}

        {/* Typing Indicator */}
        {isLoading && (
          <div className={styles.typingIndicator}>
            <div className={styles.typingDot}></div>
            <div className={styles.typingDot}></div>
            <div className={styles.typingDot}></div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {messages.length > 0 && !isLoading && (
        <div className={styles.suggestionsBar}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              className={styles.suggestionChip}
              onClick={() => handleSuggestionClick(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <form className={styles.inputArea} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className={styles.chatInput}
          type="text"
          placeholder="Ask SkyBot anything..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          id="ai-chat-input"
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!inputText.trim() || isLoading}
          title="Send message"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
