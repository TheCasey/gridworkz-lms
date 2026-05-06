import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const FONT = "'Super Sans VF', system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif";

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  backgroundColor: '#ffffff',
  border: '1px solid #dcd7d3',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: 460,
  color: '#292827',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: FONT,
  transition: 'border-color 0.15s',
};

const labelStyle = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 460,
  color: '#292827',
  marginBottom: '6px',
  fontFamily: FONT,
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, signup, resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    const result = isSignUp ? await signup(email, password) : await login(email, password);
    setLoading(false);
    if (result.success) {
      setMessage(isSignUp ? 'Account created successfully!' : 'Login successful!');
    } else {
      setError(result.error);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) { setError('Please enter your email address first.'); return; }
    setError('');
    setMessage('');
    setLoading(true);
    const result = await resetPassword(email);
    setLoading(false);
    if (result.success) {
      setMessage('Password reset email sent. Check your inbox.');
    } else {
      setError(result.error);
    }
  };

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setMessage('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #201f45 0%, #1b1938 50%, #14122e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 16px',
      fontFamily: FONT,
    }}>

      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ width: '28px', height: '2px', backgroundColor: '#cbb7fb', margin: '0 auto 20px' }} />
        <h1 style={{
          fontSize: '48px',
          fontWeight: 540,
          lineHeight: 0.96,
          letterSpacing: '-1.32px',
          color: 'rgba(255,255,255,0.95)',
          margin: 0,
          fontFamily: FONT,
        }}>
          GRIDWORKZ
        </h1>
        <p style={{
          fontSize: '12px',
          fontWeight: 460,
          color: 'rgba(255,255,255,0.45)',
          marginTop: '14px',
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          fontFamily: FONT,
        }}>
          Learning Management System
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#ffffff',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '16px',
        padding: '40px',
      }}>
        <p style={{
          fontSize: '20px',
          fontWeight: 460,
          lineHeight: 1.25,
          letterSpacing: '-0.4px',
          color: '#292827',
          margin: '0 0 24px',
          fontFamily: FONT,
        }}>
          {isSignUp ? 'Create your account' : 'Sign in to your account'}
        </p>

        {/* Feedback */}
        {error && (
          <div style={{ backgroundColor: '#f5f0ff', border: '1px solid #cbb7fb', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '14px', fontWeight: 460, color: '#292827', fontFamily: FONT }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ backgroundColor: '#e9e5dd', border: '1px solid #dcd7d3', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '14px', fontWeight: 460, color: '#292827', fontFamily: FONT }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Email address</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#292827'}
              onBlur={(e) => e.target.style.borderColor = '#dcd7d3'}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#292827'}
              onBlur={(e) => e.target.style.borderColor = '#dcd7d3'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#dcd7d3' : '#e9e5dd',
              color: '#292827',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: FONT,
              transition: 'background-color 0.15s',
            }}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={handleToggleMode}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: '14px', fontWeight: 460, color: '#714cb6', cursor: 'pointer', textDecoration: 'underline', fontFamily: FONT }}
          >
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </button>

          {!isSignUp && (
            <button
              type="button"
              onClick={handlePasswordReset}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: '14px', fontWeight: 460, color: '#714cb6', cursor: 'pointer', textDecoration: 'underline', fontFamily: FONT }}
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>

      <p style={{ marginTop: '24px', fontSize: '12px', fontWeight: 460, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: FONT }}>
        Student access via unique URL
      </p>
    </div>
  );
};

export default LoginPage;
