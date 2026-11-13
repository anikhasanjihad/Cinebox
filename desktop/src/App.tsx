import {useEffect, useRef} from 'react';
import {HashRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate} from 'react-router-dom';
import {useParty} from './lib/party';
import {AuthProvider, useAuth} from './store/auth';
import {ServersProvider} from './store/servers';
import {Sidebar} from './components/Parts';
import Login from './pages/Login';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import Settings from './pages/Settings';
import Info from './pages/Info';
import Player from './pages/Player';
import Intro from './components/Intro';
import LiveTv from './pages/LiveTv';
import Downloads from './pages/Downloads';

/** Guests: when the host picks something, open it here too. */
const PartyBridge = () => {
  const {content, isHost, code} = useParty();
  const nav = useNavigate();
  const loc = useLocation();
  const last = useRef('');
  useEffect(() => { if (!code) last.current = ''; }, [code]);
  useEffect(() => {
    if (!content || isHost) return;
    const key = JSON.stringify(content.params);
    if (key === last.current) return;
    last.current = key;
    nav('/watch', {replace: loc.pathname === '/watch', state: {...content.params, back: '/settings/party'}});
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

const Shell = () => {
  const {session, ready} = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="login"><img src="/logo.png" width={72} height={72} style={{borderRadius: 20}} alt="" /></div>;
  if (!session) return <Login />;
  const watching = loc.pathname === '/watch';
  return (
    <ServersProvider>
      {watching ? (
        <Outlet />
      ) : (
        <div className="shell">
          <Sidebar />
          <main className="main" key={loc.pathname}><Outlet /></main>
        </div>
      )}
    </ServersProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Intro />
      <HashRouter>
        <PartyBridge />
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="search" element={<Search />} />
            <Route path="library" element={<Library />} />
            <Route path="live" element={<LiveTv />} />
            <Route path="downloads" element={<Downloads />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/:section" element={<Settings />} />
            <Route path="info" element={<Info />} />
            <Route path="watch" element={<Player />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
