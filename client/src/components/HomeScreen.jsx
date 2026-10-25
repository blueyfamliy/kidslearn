import { useState, useEffect } from 'react';
import { fetchChildren, deleteChild, IS_WEB } from '../api';
import AddChildModal from './AddChildModal';
import RewardsModal from './RewardsModal';
import { APP_VERSION } from '../version';
import './HomeScreen.css';

const SUBJECT_DESC = {
  math: { desc: 'חשבון', tag: 'תרגילי חשבון', icon: '➕' },
  hebrew: { desc: 'עברית', tag: 'תרגילי אותיות', icon: '🔤' },
  english: { desc: 'אנגלית', tag: 'English', icon: '🇬🇧' },
};

const GRADE_TAGS = {
  gan_to_a: '🎓 הכנה לכיתה א׳',
  a_to_b: '🎓 הכנה לכיתה ב׳',
};

function subjectsOf(child) {
  const subs = Array.isArray(child.subjects) && child.subjects.length
    ? child.subjects
    : [child.subject || 'math'];
  // A paused subject (e.g. English until school starts) is hidden everywhere.
  return subs.filter(s => !(s === 'english' && child.hideEnglish));
}

export default function HomeScreen({ onSelect, onMistakes, onParents }) {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [pickingSubjectFor, setPickingSubjectFor] = useState(null);
  const [rewardsFor, setRewardsFor] = useState(null);

  function load() {
    fetchChildren()
      .then(data => { setChildren(data.children || []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleDelete(e, child) {
    e.stopPropagation();
    if (!window.confirm(`למחוק את ${child.name}? (ההיסטוריה תישאר)`)) return;
    try {
      await deleteChild(child.id);
      setChildren(cs => cs.filter(c => c.id !== child.id));
    } catch (err) {
      alert(err.message);
    }
  }

  function photoFor(child) {
    const emoji = child.avatar || (child.gender === 'girl' ? '👧' : '👦');
    // Legacy data may still carry a photo; otherwise show the avatar emoji.
    if (child.photo && !child.avatar) {
      return (
        <img
          src={child.photo}
          alt={child.name}
          className="child-photo"
          onError={e => { e.target.outerHTML = `<div class="child-photo child-emoji">${emoji}</div>`; }}
        />
      );
    }
    return <div className="child-photo child-emoji">{emoji}</div>;
  }

  return (
    <div className="home">
      <div className="home-title">
        <div className="home-stars">⭐ KidsLearn ⭐ <span className="app-version">v{APP_VERSION}</span></div>
        <h1>ברוכים הבאים!</h1>
        <p>{!loading && children.length === 0 ? 'הוסיפו ילד/ה כדי להתחיל ✨' : 'מי רוצה ללמוד היום?'}</p>
      </div>

      <div className="home-cards">
        {loading && <div className="home-loading">טוען...</div>}

        {!loading && children.map(child => {
          const subs = subjectsOf(child);
          const desc = subs.map(s => SUBJECT_DESC[s]?.desc || s).join(' · ');
          const tag = GRADE_TAGS[child.grade]
            || (subs.length > 1 ? '✨ בחירת מקצוע' : (SUBJECT_DESC[subs[0]]?.tag || ''));
          return (
            <button
              key={child.id}
              className={`child-card ${child.subject === 'hebrew' ? 'daughter' : 'son'}`}
              onClick={() => {
                if (editMode) return;
                if (subs.length > 1) setPickingSubjectFor(child);
                else onSelect(child.id, child.name, subs[0]);
              }}
            >
              {editMode && (
                <>
                  <span className="card-delete" onClick={e => handleDelete(e, child)}>✕</span>
                  <span
                    className="card-edit"
                    onClick={e => { e.stopPropagation(); setEditingChild(child); }}
                  >✏️</span>
                </>
              )}
              {!editMode && (
                <>
                  <span
                    className="card-mistakes"
                    title="תרגול טעויות"
                    onClick={e => { e.stopPropagation(); onMistakes(child.id, child.name); }}
                  >🔁</span>
                  <span
                    className="card-rewards"
                    title="אלבום מדבקות והישגים"
                    onClick={e => { e.stopPropagation(); setRewardsFor(child); }}
                  >🏆</span>
                </>
              )}
              {photoFor(child)}
              <div className="child-name">{child.name}</div>
              <div className="child-desc">{desc}</div>
              <div className="child-tag">{tag}</div>
              {child.todayPlan && (
                <div className="plan-progress">
                  {child.todayPlan.complete ? (
                    <div className="plan-done">🏖️ המשימות של היום הושלמו!</div>
                  ) : (
                    child.todayPlan.subjects.map(p => (
                      <div key={p.subject} className={`plan-line ${p.done >= p.target ? 'ok' : ''}`}>
                        <span>{SUBJECT_DESC[p.subject]?.icon} {SUBJECT_DESC[p.subject]?.desc}</span>
                        <span className="plan-nums">
                          {Math.min(p.done, p.target)}/{p.target} {p.done >= p.target ? '✓' : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </button>
          );
        })}

        {!loading && (
          <button className="child-card add-card" onClick={() => setShowAdd(true)}>
            <div className="add-plus">＋</div>
            <div className="child-name">הוסף ילד/ה</div>
            <div className="child-tag">שם · אווטאר · בן/בת</div>
          </button>
        )}
      </div>

      <div className="home-bottom">
        <div className="home-date">
          📅 {new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <div className="home-actions">
          {IS_WEB && (
            <a className="upgrade-btn" href="../pricing.html">💎 מנוי KidsLearn</a>
          )}
          <button className="edit-btn" onClick={() => setEditMode(m => !m)}>
            {editMode ? '✓ סיום' : '✏️ עריכה'}
          </button>
          <button className="parents-btn" onClick={onParents}>
            👨‍👩‍👧 אזור הורים
          </button>
        </div>
      </div>

      {pickingSubjectFor && (
        <div className="modal-overlay" onClick={() => setPickingSubjectFor(null)}>
          <div className="subject-picker" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPickingSubjectFor(null)}>✕</button>
            <h2>{pickingSubjectFor.name}, מה לומדים היום?</h2>
            <div className="subject-pick-row">
              {subjectsOf(pickingSubjectFor).map(s => (
                <button
                  key={s}
                  className={`subject-pick-btn ${['hebrew', 'english'].includes(s) ? s : 'math'}`}
                  onClick={() => {
                    const c = pickingSubjectFor;
                    setPickingSubjectFor(null);
                    onSelect(c.id, c.name, s);
                  }}
                >
                  <span className="subject-pick-icon">{SUBJECT_DESC[s]?.icon}</span>
                  <span>{SUBJECT_DESC[s]?.desc || s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {rewardsFor && (
        <RewardsModal
          child={rewardsFor.id}
          childName={rewardsFor.name}
          onClose={() => setRewardsFor(null)}
        />
      )}

      {(showAdd || editingChild) && (
        <AddChildModal
          editChild={editingChild}
          onClose={() => { setShowAdd(false); setEditingChild(null); }}
          onSaved={(child) => {
            setShowAdd(false);
            setEditingChild(null);
            setChildren(cs => cs.some(c => c.id === child.id)
              ? cs.map(c => (c.id === child.id ? child : c))
              : [...cs, child]);
          }}
        />
      )}
    </div>
  );
}
