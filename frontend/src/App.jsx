import { BrowserRouter, Route, Routes, Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import UserDashboard from './pages/UserDashboard'
import AdminDashboard from './pages/AdminDashboard'

const DashboardRedirect = () => {
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      const isDev = window.location.port === '5173' || window.location.port === '3000';
      const baseUrl = isDev ? 'http://localhost:5000' : '';
      const redirectUrl = `${baseUrl}/?name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&isadmin=${user.isAdmin}`;
      window.location.href = redirectUrl;
    }
  }, [user])

  return null
}

const Header = () => {
  const location = useLocation();
  const { user, loading } = useAuth(); 
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Logo */}
        <Link to="/" className="logo">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
          </div>
          <span className="logo-text">GastricCare</span>
        </Link>

        {/* Navigation */}
        <nav className="header-nav">
          <a href="/home" className="nav-link">Home</a>
          <a href="/about" className="nav-link">About Us</a>
          <a href="/risk" className="nav-link">Risk Assessment</a>
          
          {user ? (
            <>
              <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>History</Link>
              {user.isAdmin && (
                <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}>Admin</Link>
              )}
            </>
          ) : !loading && (
            <>
              <Link to="/login" className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}>Login</Link>
              <Link to="/signup" className={`nav-link ${location.pathname === '/signup' ? 'active' : ''}`}>Sign Up</Link>
            </>
          )}
          
          <a href="/donate" className="nav-link">Donate</a>
          {user && <a href="/logout" className="nav-link">Logout</a>}

          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />
  }
  return children
}

const LayoutWrapper = ({ children }) => {
  const location = useLocation();
  const hideHeader = ['/login', '/signup', '/forgot-password'].includes(location.pathname);

  return (
    <div className="app-shell">
      <div className="app-background" />
      {!hideHeader && <Header />}
      <main className="main-content" style={{ paddingTop: hideHeader ? '0' : '100px' }}>
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LayoutWrapper>
          <Routes>
            <Route path="/" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          </Routes>
        </LayoutWrapper>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
