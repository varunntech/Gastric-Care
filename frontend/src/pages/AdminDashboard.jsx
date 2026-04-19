import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      navigate('/'); // Redirect non-admins
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchAllReports = async () => {
      try {
        const q = query(
          collection(db, 'reports'),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
        const querySnapshot = await getDocs(q);
        const reportsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setReports(reportsList);
      } catch (err) {
        console.error("Admin Error:", err);
        setError('Failed to load global reports. Check your Firestore permissions.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.isAdmin) {
      fetchAllReports();
    }
  }, [user]);

  const filteredReports = reports.filter(r => 
    r.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadReport = async (reportData) => {
    try {
      const response = await fetch('/api/download_report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reportData, skip_email: true })
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Admin_Report_${reportData.patient_name}_${reportData.date}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Download error: ' + err.message);
    }
  };

  if (authLoading || !user?.isAdmin) {
    return <div style={{ textAlign: 'center', padding: '100px' }}><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-page" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '24px' }}>
        <div>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Admin Control Center</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Monitoring and managing all platform risk assessments.</p>
        </div>
        <div className="search-box" style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Search patients or emails..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              padding: '16px 24px', 
              borderRadius: '16px', 
              border: '1px solid var(--glass-border)', 
              minWidth: '350px',
              outline: 'none',
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              boxShadow: 'var(--shadow-md)',
              transition: 'all 0.2s ease'
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><div className="spinner"></div></div>
      ) : error ? (
        <div style={{ background: 'var(--error)', padding: '24px', borderRadius: '16px', color: 'white', fontWeight: 600 }}>{error}</div>
      ) : (
        <div className="table-wrapper" style={{ 
          background: 'var(--glass-bg)', 
          backdropFilter: 'var(--glass-blur)',
          borderRadius: '32px', 
          border: '1px solid var(--glass-border)', 
          overflow: 'hidden', 
          boxShadow: 'var(--shadow-xl)' 
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <th style={{ padding: '24px', color: 'var(--text-tertiary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient Name</th>
                  <th style={{ padding: '24px', color: 'var(--text-tertiary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Identity</th>
                  <th style={{ padding: '24px', color: 'var(--text-tertiary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                  <th style={{ padding: '24px', color: 'var(--text-tertiary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk Status</th>
                  <th style={{ padding: '24px', color: 'var(--text-tertiary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Probability</th>
                  <th style={{ padding: '24px', color: 'var(--text-tertiary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{report.patient_name || 'System User'}</td>
                    <td style={{ padding: '24px', color: 'var(--text-secondary)' }}>{report.email || '—'}</td>
                    <td style={{ padding: '24px', color: 'var(--text-tertiary)' }}>{report.date || 'Today'}</td>
                    <td style={{ padding: '24px' }}>
                      <span style={{ 
                        padding: '6px 14px', 
                        borderRadius: '100px', 
                        fontSize: '0.75rem', 
                        fontWeight: 800, 
                        textTransform: 'uppercase',
                        background: report.risk_level?.toLowerCase() === 'high' ? 'rgba(239, 68, 68, 0.15)' : (report.risk_level?.toLowerCase() === 'moderate' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                        color: report.risk_level?.toLowerCase() === 'high' ? 'var(--error)' : (report.risk_level?.toLowerCase() === 'moderate' ? 'var(--warning)' : 'var(--success)'),
                      }}>
                        {report.risk_level || 'Normal'}
                      </span>
                    </td>
                    <td style={{ padding: '24px', fontWeight: 800, color: 'var(--primary-600)', fontSize: '1.1rem' }}>
                      {((report.probability_of_cancer || 0) * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '24px' }}>
                      <button 
                        onClick={() => downloadReport(report)}
                        style={{ 
                          padding: '10px 20px', 
                          background: 'var(--primary-600)', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '12px', 
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)'
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredReports.length === 0 && (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '1.1rem' }}>No clinical records found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
