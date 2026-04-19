import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const UserDashboard = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [indexUrl, setIndexUrl] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      if (!user?.email) return;
      try {
        const q = query(
          collection(db, 'reports'),
          where('email', '==', user.email),
          orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const reportsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setReports(reportsList);
      } catch (err) {
        console.error("Error fetching reports:", err);
        const errorMessage = err.message || '';
        if (errorMessage.includes('index')) {
          const urlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
          if (urlMatch) {
            setIndexUrl(urlMatch[0]);
            setError('Database configuration required. Please click the button below to enable history.');
          } else {
            setError('Database setup in progress. Please try again in a few minutes.');
          }
        } else {
          setError('Failed to load your history. Make sure you have completed at least one assessment.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [user]);

  const downloadReport = async (reportData) => {
    try {
      // We re-post the saved data to the Flask endpoint to re-generate the PDF
      const response = await fetch('/api/download_report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reportData, skip_email: true })
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Gastric_Risk_Report_${reportData.date || 'history'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Error downloading report: ' + err.message);
    }
  };

  return (
    <div className="dashboard-page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.56rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Your Assessment History</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>View and download your previous gastric cancer risk reports.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><div className="spinner"></div></div>
      ) : error ? (
        <div className="error-message" style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '30px', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, marginBottom: '16px' }}>{error}</p>
          {indexUrl && (
            <a 
              href={indexUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'inline-block', padding: '12px 28px', background: 'var(--error)', color: 'white', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, boxShadow: '0 8px 16px rgba(239, 68, 68, 0.2)' }}
            >
              Fix Database Index Now
            </a>
          )}
        </div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', borderRadius: '32px', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-lg)' }}>
          <p style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>No reports found yet.</p>
          <a href="/risk" style={{ display: 'inline-block', marginTop: '30px', padding: '16px 32px', background: 'var(--primary-600)', color: 'white', borderRadius: '16px', textDecoration: 'none', fontWeight: 700, boxShadow: 'var(--shadow-glow)' }}>
            Start Your First Assessment
          </a>
        </div>
      ) : (
        <div className="reports-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '32px' }}>
          {reports.map((report) => (
            <div key={report.id} className="report-card" style={{ background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '32px', boxShadow: 'var(--shadow-md)', transition: 'all 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                  {report.timestamp?.toDate ? report.timestamp.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : (report.date || 'Recent')}
                </span>
                <span style={{ 
                  padding: '6px 14px', 
                  borderRadius: '100px', 
                  fontSize: '0.75rem', 
                  fontWeight: 800, 
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: report.risk_level?.toLowerCase() === 'high' ? 'rgba(239, 68, 68, 0.15)' : (report.risk_level?.toLowerCase() === 'moderate' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                  color: report.risk_level?.toLowerCase() === 'high' ? 'var(--error)' : (report.risk_level?.toLowerCase() === 'moderate' ? 'var(--warning)' : 'var(--success)'),
                  border: '1px solid currentColor'
                }}>
                  {report.risk_level || 'Unknown'} Risk
                </span>
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>Clinical Assessment</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '24px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary-600)' }}>
                  {((report.probability_of_cancer || 0) * 100).toFixed(1)}
                </span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>%</span>
              </div>
              <button 
                onClick={() => downloadReport(report)}
                className="btn-download"
                style={{ 
                  width: '100%', 
                  padding: '16px', 
                  background: 'var(--primary-100)', 
                  color: 'var(--primary-700)', 
                  border: 'none', 
                  borderRadius: '16px', 
                  fontWeight: 700, 
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '1rem'
                }}
              >
                Download Patient Report (PDF)
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
