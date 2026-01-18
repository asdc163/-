
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import SplashView from './views/SplashView';
import RoleSelectionView from './views/RoleSelectionView';
import RegisterView from './views/RegisterView';
import ContactSetupView from './views/ContactSetupView';
import FrequencySettingsView from './views/FrequencySettingsView';
import DashboardView from './views/DashboardView';
import GuardianMapView from './views/GuardianMapView';
import SOSAlertView from './views/SOSAlertView';
import SafetyLogView from './views/SafetyLogView';
import PrivacySettingsView from './views/PrivacySettingsView';
import { Role, User } from './types';

const AppContent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Simulated splash delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <SplashView />;

  return (
    <div className="relative min-h-screen bg-background-light dark:bg-background-dark max-w-md mx-auto shadow-2xl overflow-x-hidden">
      <div className="bg-noise"></div>
      <Routes>
        <Route path="/" element={<RoleSelectionView onSelectRole={(role) => navigate('/register', { state: { role } })} />} />
        <Route path="/register" element={<RegisterView />} />
        <Route path="/setup-contacts" element={<ContactSetupView />} />
        <Route path="/setup-frequency" element={<FrequencySettingsView />} />
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/guardian-map" element={<GuardianMapView />} />
        <Route path="/sos-alert" element={<SOSAlertView />} />
        <Route path="/logs" element={<SafetyLogView />} />
        <Route path="/privacy" element={<PrivacySettingsView />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
