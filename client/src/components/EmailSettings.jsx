import { useState, useEffect } from 'react';
import { fetchEmailConfig, saveEmailConfig, testEmail, verifyEmail } from '../api';
import './EmailSettings.css';

export default function EmailSettings() {
  const [cfg, setCfg] = useState({
    enabled: false,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    recipients: '',
  });
  const [hasPassword, setHasPassword] = useState(false);
  const [savedPassLength, setSavedPassLength] = useState(0);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function reloadConfig() {
    const c = await fetchEmailConfig();
    setCfg({ ...c, smtpPass: '' });
    setHasPassword(c.hasPassword);
    setSavedPassLength(c.passLength || 0);
    return c;
  }

  useEffect(() => {
    reloadConfig().then(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      const typedLen = (cfg.smtpPass || '').replace(/\s+/g, '').length;
      const result = await saveEmailConfig(cfg);
      // Re-read from server to confirm what was actually saved
      const fresh = await reloadConfig();
      if (typedLen > 0) {
        setStatus({
          type: 'success',
          msg: `✅ נשמרו. אורך הסיסמה שהוקלדה: ${typedLen} תווים. אורך השמורה כעת: ${fresh.passLength}.`,
        });
      } else {
        setStatus({
          type: 'success',
          msg: `✅ הגדרות נשמרו. אורך הסיסמה השמורה: ${fresh.passLength}.`,
        });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: '❌ ' + err.message });
    }
    setSaving(false);
  }

  async function handleVerify() {
    setVerifying(true);
    setStatus(null);
    try {
      const result = await verifyEmail();
      setStatus(result.ok
        ? { type: 'success', msg: `✅ ההתחברות ל-${result.user} תקינה. לא נשלח מייל.` }
        : { type: 'error', msg: '❌ ' + (result.error || 'ההתחברות נכשלה') });
    } catch (err) {
      setStatus({ type: 'error', msg: '❌ ' + err.message });
    }
    setVerifying(false);
  }

  async function handleTest() {
    setTesting(true);
    setStatus(null);
    try {
      const result = await testEmail();
      if (result.ok) {
        setStatus({ type: 'success', msg: `✅ מייל בדיקה נשלח בהצלחה ל-${cfg.recipients}` });
      } else {
        setStatus({ type: 'error', msg: '❌ ' + (result.error || 'שליחה נכשלה') });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: '❌ ' + err.message });
    }
    setTesting(false);
  }

  if (loading) return <div className="loading">טוען...</div>;

  return (
    <div className="email-settings">
      <div className="email-header">
        <h2>📧 הגדרות מייל</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={e => setCfg(c => ({ ...c, enabled: e.target.checked }))}
          />
          <span>{cfg.enabled ? 'פעיל' : 'כבוי'}</span>
        </label>
      </div>

      {/* The settings could look complete while nothing was being sent — the
          only trace was a console line on a server nobody reads. Say it here. */}
      {cfg.blockedText && (
        <div className="email-blocked">
          ⚠️ <b>דוחות לא נשלחים כרגע.</b> {cfg.blockedText}
        </div>
      )}


      <div className="form-grid">
        <label>
          <span>שרת SMTP</span>
          <input
            type="text"
            value={cfg.smtpHost}
            onChange={e => setCfg(c => ({ ...c, smtpHost: e.target.value }))}
            placeholder="smtp.gmail.com"
          />
        </label>

        <label>
          <span>פורט</span>
          <input
            type="number"
            value={cfg.smtpPort}
            onChange={e => setCfg(c => ({ ...c, smtpPort: e.target.value }))}
            placeholder="587"
          />
        </label>

        <label className="full-width">
          <span>כתובת המייל השולחת (Gmail)</span>
          <input
            type="email"
            value={cfg.smtpUser}
            onChange={e => setCfg(c => ({ ...c, smtpUser: e.target.value }))}
            placeholder="your-email@gmail.com"
            dir="ltr"
          />
        </label>

        <label className="full-width">
          <span>
            סיסמת אפליקציה{' '}
            {hasPassword && (
              <small className="badge" style={{ background: savedPassLength === 16 ? '#43a047' : '#e53935' }}>
                שמורה: {savedPassLength} תווים {savedPassLength === 16 ? '✓' : '✗ (צריך 16)'}
              </small>
            )}
          </span>
          <input
            type="text"
            value={cfg.smtpPass}
            onChange={e => setCfg(c => ({ ...c, smtpPass: e.target.value }))}
            placeholder={hasPassword ? 'הקלידי כאן App Password חדש כדי להחליף' : 'xxxx xxxx xxxx xxxx'}
            dir="ltr"
            autoComplete="off"
            spellCheck="false"
          />
          {cfg.smtpPass && (
            <small style={{ color: '#666', marginTop: 4 }}>
              אורך מה שהוקלד (ללא רווחים): {cfg.smtpPass.replace(/\s+/g, '').length}
            </small>
          )}
        </label>

        <label className="full-width">
          <span>נמענים (מופרדים בפסיק)</span>
          <input
            type="text"
            value={cfg.recipients}
            onChange={e => setCfg(c => ({ ...c, recipients: e.target.value }))}
            placeholder="ima@gmail.com, aba@gmail.com"
            dir="ltr"
          />
        </label>
      </div>

      {status && (
        <div className={`status-msg ${status.type}`}>{status.msg}</div>
      )}

      <div className="email-actions">
        <button className="btn-primary" onClick={handleSave} disabled={saving || testing}>
          {saving ? '💾 שומר...' : '💾 שמור הגדרות'}
        </button>
        {/* Checking the login and sending a test are different questions. The
            first one answers "are my credentials right?" without putting mail
            on the wire — and tells you so without emailing anybody. */}
        <button className="btn-secondary" onClick={handleVerify} disabled={saving || testing || verifying}>
          {verifying ? '🔑 בודק...' : '🔑 בדיקת התחברות (בלי לשלוח)'}
        </button>
        <button className="btn-secondary" onClick={handleTest} disabled={saving || testing || verifying}>
          {testing ? '📤 שולח...' : '📤 שלח מייל בדיקה'}
        </button>
      </div>
    </div>
  );
}
