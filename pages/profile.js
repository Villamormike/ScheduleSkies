import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, useMemo } from 'react';
import { FaUserEdit, FaCloud, FaMapMarkerAlt, FaCalendarAlt, FaMoon, FaSun, FaSignOutAlt, FaTrashAlt, FaPlus, FaTimes } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import Sidebar from '../components/Sidebar';
import profileStyles from '../styles/profile.module.css';
import eventStyles from '../styles/event.module.css';

const THEME_STORAGE_KEY = 'schedule-skies-theme';

// Skeleton Loading Component
const SkeletonLoader = ({ count = 1, type = 'card' }) => {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className={profileStyles.skeleton} style={{ marginBottom: '1rem' }}>
          <div className={profileStyles.skeletonLine} style={{ width: '60%' }}></div>
          <div className={profileStyles.skeletonLine} style={{ width: '80%', marginTop: '0.5rem' }}></div>
        </div>
      ))}
    </>
  );
};

// Empty State Component
const EmptyState = ({ icon: Icon, title, description, actionText, onAction }) => (
  <div className={profileStyles.emptyState}>
    {Icon && <Icon className={profileStyles.emptyIcon} />}
    <h4>{title}</h4>
    <p>{description}</p>
    {actionText && onAction && (
      <button className={profileStyles.emptyAction} onClick={onAction}>
        <FaPlus /> {actionText}
      </button>
    )}
  </div>
);

// Location Item Component
const LocationItem = ({ location, onDelete, isDeleting }) => (
  <div className={profileStyles.listItem}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
      <FaMapMarkerAlt style={{ color: '#2563eb', fontSize: '0.85rem' }} />
      <h4 style={{ margin: 0, fontSize: '1rem' }}>{location.name}</h4>
    </div>
    <span className={profileStyles.metaText}>{location.type}</span>
    {location.description && <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: '#666' }}>{location.description}</p>}
    <button 
      className={profileStyles.deleteBtn}
      onClick={() => onDelete(location.id)}
      disabled={isDeleting}
      title="Delete location"
    >
      <FaTimes />
    </button>
  </div>
);

// Itinerary Item Component
const ItineraryItem = ({ itinerary, onDelete, isDeleting }) => {
  const formatDateRange = (start, end) => {
    try {
      const s = new Date(start);
      const e = new Date(end);
      return `${s.toLocaleDateString('en-PH')} - ${e.toLocaleDateString('en-PH')}`;
    } catch {
      return `${start} - ${end}`;
    }
  };

  return (
    <div className={profileStyles.listItem}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <FaCalendarAlt style={{ color: '#2563eb', fontSize: '0.85rem' }} />
        <h4 style={{ margin: 0, fontSize: '1rem' }}>{itinerary.name}</h4>
      </div>
      <span className={profileStyles.metaText}>{formatDateRange(itinerary.start_date, itinerary.end_date)}</span>
      {itinerary.budget_php && (
        <span className={profileStyles.metaText}>₱{itinerary.budget_php.toLocaleString('en-PH')}</span>
      )}
      {itinerary.description && <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: '#666' }}>{itinerary.description}</p>}
      <span style={{ display: 'inline-block', fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', marginTop: '0.3rem' }}>
        {itinerary.status}
      </span>
      <button 
        className={profileStyles.deleteBtn}
        onClick={() => onDelete(itinerary.id)}
        disabled={isDeleting}
        title="Delete itinerary"
      >
        <FaTimes />
      </button>
    </div>
  );
};


const ProfilePage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Preferences');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [themeMode, setThemeMode] = useState('light');

  // Profile Data
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [budgetPhp, setBudgetPhp] = useState(5000);
  const [environment, setEnvironment] = useState('Both');
  const [pace, setPace] = useState('Relaxed');
  const [emailUpdates, setEmailUpdates] = useState(true);

  // Lists & Analytics
  const [locations, setLocations] = useState([]);
  const [itineraries, setItineraries] = useState([]);
  const [analytics, setAnalytics] = useState({
    trips_taken: 0,
    places_visited: 0,
    most_visited_city: null
  });
  const [authUserId, setAuthUserId] = useState('');
  const [sessionToken, setSessionToken] = useState('');

  // Delete operations
  const [deletingLocationId, setDeletingLocationId] = useState(null);
  const [deletingItineraryId, setDeletingItineraryId] = useState(null);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);

  const showMessage = (type, value) => {
    setMessageType(type);
    setMessage(value);
    setTimeout(() => setMessage(''), 4000);
  };

  // Load theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeMode(savedTheme);
    }
  }, []);

  // Persist theme
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const { data: authData, error: userError } = await supabase.auth.getUser();
        const authUser = authData?.user;

        if (userError || !authUser) {
          router.push('/login');
          return;
        }

        setAuthUserId(authUser.id);
        setEmail(authUser.email || '');

        // Get session token for API calls
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          setSessionToken(token);
        }

        // Fetch complete profile with relations
        const res = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch profile: ${res.status}`);
        }

        const data = await res.json();

        // Set profile fields
        setFullName(data.profile?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User');
        setBudgetPhp(data.profile?.budget_php || 5000);
        setEnvironment(data.profile?.environment || 'Both');
        setPace(data.profile?.pace || 'Relaxed');
        setEmailUpdates(data.profile?.email_updates !== false);

        // Set lists and analytics
        setLocations(data.saved_locations || []);
        setItineraries(data.saved_itineraries || []);
        setAnalytics(data.analytics || {
          trips_taken: 0,
          places_visited: 0,
          most_visited_city: null
        });
      } catch (err) {
        console.error('Error fetching profile:', err.message);
        showMessage('error', 'Failed to load profile. Please refresh.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [router]);

  const handleSaveProfile = async () => {
    if (!authUserId || !sessionToken) return;

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          budget_php: Number(budgetPhp),
          environment,
          pace,
          email_updates: emailUpdates
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to save: ${res.status}`);
      }

      showMessage('success', 'Profile preferences saved successfully.');
    } catch (err) {
      console.error('Save error:', err);
      showMessage('error', err.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async (locationId) => {
    if (!sessionToken) return;
    
    setDeletingLocationId(locationId);
    try {
      const res = await fetch('/api/saved-locations', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ id: locationId })
      });

      if (!res.ok) throw new Error('Failed to delete location');

      setLocations(prev => prev.filter(loc => loc.id !== locationId));
      showMessage('success', 'Location removed.');
    } catch (err) {
      showMessage('error', 'Failed to delete location.');
    } finally {
      setDeletingLocationId(null);
    }
  };

  const handleDeleteItinerary = async (itineraryId) => {
    if (!sessionToken) return;

    setDeletingItineraryId(itineraryId);
    try {
      const res = await fetch('/api/saved-itineraries', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ id: itineraryId })
      });

      if (!res.ok) throw new Error('Failed to delete itinerary');

      setItineraries(prev => prev.filter(itin => itin.id !== itineraryId));
      showMessage('success', 'Itinerary removed.');
    } catch (err) {
      showMessage('error', 'Failed to delete itinerary.');
    } finally {
      setDeletingItineraryId(null);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showMessage('error', 'Password must be at least 6 characters.');
      return;
    }

    setSecurityLoading(true);
    setMessage('');
    
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword('');
      showMessage('success', 'Password updated successfully.');
    } catch (err) {
      showMessage('error', `Password update failed: ${err.message}`);
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.prompt('Type DELETE to permanently remove your account.');
    if (confirmDelete !== 'DELETE') return;

    if (!sessionToken) {
      showMessage('error', 'Session expired. Please log in again.');
      return;
    }

    setSecurityLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        }
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result?.error || 'Failed to delete account.');
      }

      await supabase.auth.signOut();
      router.push('/signup');
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setSecurityLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={profileStyles.loadingScreen}>
        <div style={{ textAlign: 'center' }}>
          <div className={profileStyles.spinner}></div>
          <p style={{ marginTop: '1rem', color: '#2c3e50' }}>Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Account Profile - ScheduleSkies</title>
      </Head>
      <div className={eventStyles.appContainer}>
        <Sidebar />
        <main className={eventStyles.mainContent} style={{ padding: 0 }}>
          <div className={eventStyles.sun}></div>
          <div className={`${eventStyles.cloud} ${eventStyles.cloud1}`}></div>
          <div className={`${eventStyles.cloud} ${eventStyles.cloud2}`}></div>

          {/* Profile Header */}
          <header className={profileStyles.profileHeader}>
            <div className={profileStyles.profilePicture}>
              {(fullName || 'U').charAt(0).toUpperCase()}
            </div>
            <div className={profileStyles.profileInfo}>
              <h1>{fullName || 'GUEST'}</h1>
              <p className={profileStyles.profileEmail}>{email}</p>
              <div className={profileStyles.quickStats}>
                <span>{itineraries.length} itineraries</span>
                <span>{locations.length} saved places</span>
                <span>{analytics.trips_taken} trips</span>
              </div>
            </div>
          </header>

          <div className={profileStyles.profileBody}>
            {/* Tab Navigation */}
            <div className={profileStyles.tabNav}>
              {['Preferences', 'Itineraries & Locations', 'Analytics', 'Account'].map(tab => (
                <button
                  key={tab}
                  className={`${profileStyles.tabBtn} ${activeTab === tab ? profileStyles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Message Alert */}
            {message && (
              <div className={`${profileStyles.message} ${messageType === 'error' ? profileStyles.messageError : profileStyles.messageSuccess}`}>
                {message}
              </div>
            )}

            {/* Tab Content */}
            <div className={profileStyles.tabContent}>
              {activeTab === 'Preferences' && (
                <>
                  <div className={profileStyles.cardGrid}>
                    <div className={profileStyles.card}>
                      <h3><FaUserEdit /> Profile Information</h3>
                      <div className={profileStyles.optionGroup}>
                        <label className={profileStyles.optionLabel}>Display Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className={profileStyles.profileInput}
                          placeholder="Your full name"
                        />
                      </div>
                    </div>

                    <div className={profileStyles.card}>
                      <h3><FaCloud /> Travel Preferences</h3>
                      <div className={profileStyles.optionGroup}>
                        <label className={profileStyles.optionLabel}>Environment</label>
                        <div className={profileStyles.optionsContainer}>
                          {['Indoor', 'Outdoor', 'Both'].map(opt => (
                            <button
                              key={opt}
                              type="button"
                              className={`${profileStyles.optionBtn} ${environment === opt ? profileStyles.optionActive : ''}`}
                              onClick={() => setEnvironment(opt)}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className={profileStyles.optionGroup}>
                        <label className={profileStyles.optionLabel}>Pace</label>
                        <div className={profileStyles.optionsContainer}>
                          {['Relaxed', 'Moderate', 'Fast-paced'].map(opt => (
                            <button
                              key={opt}
                              type="button"
                              className={`${profileStyles.optionBtn} ${pace === opt ? profileStyles.optionActive : ''}`}
                              onClick={() => setPace(opt)}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className={profileStyles.card}>
                      <h3>💰 Trip Budget (PHP)</h3>
                      <div className={profileStyles.optionGroup}>
                        <label className={profileStyles.optionLabel}>Budget Amount</label>
                        <div className={profileStyles.budgetInputGroup}>
                          <span className={profileStyles.currencySymbol}>₱</span>
                          <input
                            type="number"
                            value={budgetPhp}
                            onChange={(e) => setBudgetPhp(Number(e.target.value))}
                            className={profileStyles.budgetInput}
                            placeholder="5000"
                            min="0"
                            step="500"
                          />
                        </div>
                        <small className={profileStyles.budgetHelper}>
                          Recommended: ₱5,000 - ₱50,000 for day trips; ₱20,000+ for multi-day
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className={profileStyles.actionButtons}>
                    <button 
                      className={profileStyles.primaryBtn}
                      onClick={handleSaveProfile}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Preferences'}
                    </button>
                    <button
                      className={profileStyles.logoutBtn}
                      onClick={handleLogout}
                    >
                      <FaSignOutAlt /> Log Out
                    </button>
                  </div>
                </>
              )}

              {activeTab === 'Itineraries & Locations' && (
                <div className={profileStyles.cardGrid}>
                  <div className={profileStyles.card}>
                    <h3><FaCalendarAlt /> Saved Itineraries ({itineraries.length})</h3>
                    <div className={profileStyles.listContainer}>
                      {itineraries.length === 0 ? (
                        <EmptyState
                          icon={FaCalendarAlt}
                          title="No itineraries yet"
                          description="Create your first trip plan from the Plan page"
                        />
                      ) : (
                        itineraries.map(itin => (
                          <ItineraryItem
                            key={itin.id}
                            itinerary={itin}
                            onDelete={handleDeleteItinerary}
                            isDeleting={deletingItineraryId === itin.id}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  <div className={profileStyles.card}>
                    <h3><FaMapMarkerAlt /> Favorite Locations ({locations.length})</h3>
                    <div className={profileStyles.listContainer}>
                      {locations.length === 0 ? (
                        <EmptyState
                          icon={FaMapMarkerAlt}
                          title="No saved locations"
                          description="Mark your favorite places while planning trips"
                        />
                      ) : (
                        locations.map(loc => (
                          <LocationItem
                            key={loc.id}
                            location={loc}
                            onDelete={handleDeleteLocation}
                            isDeleting={deletingLocationId === loc.id}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Analytics' && (
                <div className={profileStyles.card}>
                  <h3>📊 Travel Analytics</h3>
                  <div className={profileStyles.analyticsGrid}>
                    <div className={profileStyles.statBox}>
                      <span className={profileStyles.statValue}>{analytics.trips_taken}</span>
                      <span className={profileStyles.statLabel}>Trips Taken</span>
                    </div>
                    <div className={profileStyles.statBox}>
                      <span className={profileStyles.statValue}>{analytics.places_visited}</span>
                      <span className={profileStyles.statLabel}>Places Visited</span>
                    </div>
                    <div className={profileStyles.statBox}>
                      <span className={profileStyles.statValue}>{analytics.most_visited_city || 'N/A'}</span>
                      <span className={profileStyles.statLabel}>Most Visited City</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Account' && (
                <div className={profileStyles.cardGrid}>
                  <div className={profileStyles.card}>
                    <h3>{themeMode === 'dark' ? <FaMoon /> : <FaSun />} Theme</h3>
                    <div className={profileStyles.segmented}>
                      <button
                        type="button"
                        className={`${profileStyles.segmentBtn} ${themeMode === 'light' ? profileStyles.segmentBtnActive : ''}`}
                        onClick={() => setThemeMode('light')}
                      >
                        Light Mode
                      </button>
                      <button
                        type="button"
                        className={`${profileStyles.segmentBtn} ${themeMode === 'dark' ? profileStyles.segmentBtnActive : ''}`}
                        onClick={() => setThemeMode('dark')}
                      >
                        Dark Mode
                      </button>
                    </div>
                    <div className={profileStyles.toggleItem}>
                      <span>Email updates</span>
                      <label className={profileStyles.toggleSwitch}>
                        <input
                          type="checkbox"
                          checked={emailUpdates}
                          onChange={(e) => setEmailUpdates(e.target.checked)}
                        />
                        <span className={profileStyles.slider}></span>
                      </label>
                    </div>
                  </div>

                  <div className={profileStyles.card}>
                    <h3>🔐 Security</h3>
                    <div className={profileStyles.optionGroup}>
                      <label className={profileStyles.optionLabel}>New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={profileStyles.profileInput}
                        placeholder="At least 6 characters"
                      />
                    </div>
                    <div className={profileStyles.actionButtons}>
                      <button
                        type="button"
                        className={profileStyles.secondaryBtn}
                        onClick={handleChangePassword}
                        disabled={securityLoading}
                      >
                        Update Password
                      </button>
                      <button
                        type="button"
                        className={profileStyles.dangerBtn}
                        onClick={handleDeleteAccount}
                        disabled={securityLoading}
                      >
                        <FaTrashAlt /> Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default ProfilePage;
