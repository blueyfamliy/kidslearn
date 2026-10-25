import { useState, useEffect } from 'react';
import { fetchExercises, fetchMistakes, fetchChildren, saveSession } from '../api';
import { MATH_TOPICS, topicsForChild } from '../../../server/exercises/mathGenerator.js';
import { speakCelebration, speakEncouragement, speakEnglish, setSpeechGender } from '../lib/tts';
import { playCorrect, playWrong } from '../lib/sfx';
import ExerciseCard from './ExerciseCard';
import ResultScreen from './ResultScreen';
import LessonCard from './LessonCard';
import WorkbookPage from './WorkbookPage';
import { LESSONS, familyKeyForType } from '../../../server/exercises/lessons.js';
import './ExerciseSession.css';

const MAX_ATTEMPTS = 10;
// "תרגל הכל" really runs ALL the collected mistakes (sanity-capped only).
const PRACTICE_SESSION_MAX = 50;

function shuffleList(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// What to speak as the "answer" on correct response.
// For fill_letter exercises the answer alone is just one letter, so we speak
// the full word instead — much more rewarding for the child.
function answerSpeech(ex) {
  if (ex.type === 'fill_letter' || ex.type === 'fill_letter_choice') {
    return ex.word || ex.answer;
  }
  return String(ex.answer || '');
}

// Math sessions open with this choice: practise addition, subtraction or both.
const OPERATIONS = [
  { id: 'add', icon: '➕', label: 'חיבור', cls: 'op-add' },
  { id: 'sub', icon: '➖', label: 'חיסור', cls: 'op-sub' },
  { id: 'mix', icon: '🔀', label: 'מעורב', cls: 'op-mix' },
];

function OperationPicker({ childName, topics, onPick, onBack }) {
  // Clicking a topic asks: learn it with the interactive workbook, or drill?
  const [pendingTopic, setPendingTopic] = useState(null);

  return (
    <div className="op-picker">
      <h2 className="op-picker-title">{childName}, במה נתחיל היום?</h2>
      <div className="op-row">
        {OPERATIONS.map(o => (
          <button key={o.id} className={`op-btn ${o.cls}`} onClick={() => onPick(o.id)}>
            <span className="op-icon">{o.icon}</span>
            <span className="op-text">{o.label}</span>
          </button>
        ))}
      </div>

      {topics.length > 0 && (
        <>
          <div className="topic-title">✨ או בוחרים נושא — לומדים או מתרגלים:</div>
          <div className="topic-row">
            {topics.map(t => (
              <button key={t.id} className="topic-btn" onClick={() => setPendingTopic(t)}>
                <span className="topic-icon">{t.icon}</span>
                <span className="topic-text">{t.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <button className="op-back" onClick={onBack}>חזרה</button>

      {pendingTopic && (
        <div className="book-choice-overlay" onClick={() => setPendingTopic(null)}>
          <div className="book-choice" onClick={e => e.stopPropagation()}>
            <div className="book-choice-icon">{pendingTopic.icon}</div>
            <h3 className="book-choice-title">{pendingTopic.label}</h3>
            <button className="book-choice-btn learn" onClick={() => onPick(`book:${pendingTopic.id}`)}>
              <span>📖 חוברת אינטראקטיבית</span>
              <small>לומדים צעד-צעד, פותרים יחד, ואז מתרגלים</small>
            </button>
            <button className="book-choice-btn drill" onClick={() => onPick(`topic:${pendingTopic.id}`)}>
              <span>✏️ תרגול מהיר</span>
              <small>ישר לתרגילים</small>
            </button>
            <button className="book-choice-cancel" onClick={() => setPendingTopic(null)}>ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExerciseSession({ child, childName, subject, practice, practiceType, onBack }) {
  // Behaviour keys off the subject (Hebrew = voice + letter keyboard,
  // English = English audio). Fall back to the original son/daughter mapping.
  const isHebrew = subject ? subject === 'hebrew' : child === 'daughter';
  const isEnglish = subject === 'english';
  const isMath = subject ? subject === 'math' : child === 'son';
  // Math sessions first ask which operation to focus on; Hebrew/English and
  // mistake-practice sessions skip this.
  const [operation, setOperation] = useState(null);
  const [topics, setTopics] = useState([]);       // sub-topic tiles for the picker
  const [exercises, setExercises] = useState([]);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(null);   // adaptive-difficulty outcome
  const [planStatus, setPlanStatus] = useState(null); // daily summer-plan status
  const [sticker, setSticker] = useState(null);       // today's earned sticker
  const [lesson, setLesson] = useState(null);         // mini-lesson before a new topic
  const [helpLesson, setHelpLesson] = useState(null); // on-demand "teach me" lesson
  const [workbook, setWorkbook] = useState(null);     // interactive workbook (teaching pages)
  const [bookPage, setBookPage] = useState(0);        // current workbook page
  const [attempts, setAttempts] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false); // "really leave?" overlay

  const date = new Date().toISOString().slice(0, 10);

  // The voice cheers in the child's own gender ("אלוף!" for a boy, "אלופה!"
  // for a girl) — the cheers used to be feminine for everyone.
  useEffect(() => {
    fetchChildren()
      .then(data => {
        const p = (data.children || []).find(c => c.id === child);
        if (p) setSpeechGender(p.gender);
      })
      .catch(() => {});
  }, [child]);

  // The picker offers every sub-topic of the child's curriculum (שעון, שקלים...).
  useEffect(() => {
    if (!isMath || practice) return;
    fetchChildren()
      .then(data => {
        const p = (data.children || []).find(c => c.id === child);
        if (!p) return;
        const ids = topicsForChild({ track: p.grade, level: p.mathLevel, allowMulDiv: p.allowMulDiv });
        setTopics(ids.filter(id => MATH_TOPICS[id]).map(id => ({ id, ...MATH_TOPICS[id] })));
      })
      .catch(() => {});
  }, [child, isMath, practice]);

  useEffect(() => {
    // Mistake practice: replay the child's own failed exercises, on demand.
    // "תרגל הכל" runs the WHOLE list (not a random slice), and the session
    // opens by re-teaching the topic the child struggles with most.
    if (practice) {
      setLoading(true);
      fetchMistakes(child)
        .then(data => {
          let list = (data.mistakes?.[subject] || []).map(m => m.exercise);
          if (practiceType) list = list.filter(e => e.type === practiceType);
          const session = shuffleList(list)
            .slice(0, PRACTICE_SESSION_MAX)
            .map((ex, i) => ({ ...ex, id: i + 1, isReview: false }));
          setExercises(session);
          // Teach before drilling: the lesson of the most-mistaken family.
          const famCount = {};
          for (const ex of session) {
            const fam = familyKeyForType(ex.type);
            if (fam && LESSONS[fam]) famCount[fam] = (famCount[fam] || 0) + 1;
          }
          const top = Object.entries(famCount).sort((a, b) => b[1] - a[1])[0];
          setLesson(top ? { key: top[0], ...LESSONS[top[0]], practice: true } : null);
          setLoading(false);
        })
        .catch(err => { setError(err.message); setLoading(false); });
      return;
    }
    // Wait for the operation choice before loading a math session.
    if (isMath && !operation) return;
    setLoading(true);
    fetchExercises(child, date, subject, operation || undefined)
      .then(data => {
        setExercises(data.exercises);
        setLesson(data.lesson || null);
        setWorkbook(data.workbook || null);
        setBookPage(0);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [child, date, subject, operation, isMath, practice, practiceType]);

  function buildResult(ex, finalCorrect, totalAttempts) {
    return {
      id: ex.id,
      type: ex.type,
      dir: ex.dir,
      question: ex.question,
      answer: ex.answer,
      correct: finalCorrect,
      firstAttemptCorrect: totalAttempts === 1 && finalCorrect,
      attempts: totalAttempts,
      isReview: !!ex.isReview,
      // Snapshot the original exercise so wrong ones can be resurfaced exactly
      exerciseSnapshot: ex,
    };
  }

  function advanceTo(newResults) {
    setResults(newResults);
    setAttempts(0);
    setWrongCount(0);
    setShowHint(false);
    if (current + 1 >= exercises.length) {
      finishSession(newResults);
    } else {
      setCurrent(c => c + 1);
    }
  }

  // Step back to the previous question: drop its recorded result so the child
  // simply answers it again (and the progress bar stays honest).
  function goPrev() {
    if (current === 0) return;
    setResults(r => r.slice(0, -1));
    setCurrent(c => c - 1);
    setAttempts(0);
    setWrongCount(0);
    setShowHint(false);
    setFeedback(null);
  }

  function handleAnswer(answer) {
    const ex = exercises[current];
    // English typing is case-insensitive ("Dog" === "dog").
    const norm = v => {
      const s = String(v).trim();
      return ex.caseInsensitive ? s.toLowerCase() : s;
    };
    const correct = norm(answer) === norm(ex.answer);
    const newAttempts = attempts + 1;

    if (correct) {
      setFeedback('correct');
      playCorrect();
      // Speak the answer + a random cheer for Hebrew exercises
      if (isHebrew) {
        speakCelebration(answerSpeech(ex));
      }
      // English: repeat the word with an English voice so the child hears the
      // correct pronunciation one more time.
      if (isEnglish) {
        speakEnglish(ex.word || ex.audioText || String(ex.answer));
      }
      // Give a bit more time for Hebrew/English so the audio can play
      const delay = (isHebrew || isEnglish) ? 1700 : 900;
      setTimeout(() => {
        setFeedback(null);
        const result = buildResult(ex, true, newAttempts);
        advanceTo([...results, result]);
      }, delay);
    } else {
      setAttempts(newAttempts);
      setWrongCount(wrongCount + 1);
      setFeedback('wrong');
      playWrong();

      // Voice encouragement on wrong answer (only on first mistake to avoid noise)
      if (isHebrew && newAttempts === 1) {
        speakEncouragement();
      }

      if (wrongCount + 1 >= 3) setShowHint(true);

      setTimeout(() => {
        setFeedback(null);
        if (newAttempts >= MAX_ATTEMPTS) {
          const result = buildResult(ex, false, newAttempts);
          advanceTo([...results, result]);
        }
      }, 700);
    }
  }

  async function finishSession(finalResults) {
    setDone(true);
    const res = await saveSession({ child, childName, date, subject, results: finalResults, practice: !!practice });
    if (res?.progress) setProgress(res.progress);
    if (res?.planStatus) setPlanStatus(res.planStatus);
    if (res?.sticker) setSticker(res.sticker);
  }

  // Math: ask which operation/topic to practise before anything loads.
  if (isMath && !practice && !operation) {
    return <OperationPicker childName={childName} topics={topics} onPick={setOperation} onBack={onBack} />;
  }

  if (loading) return (
    <div className="session-loading">
      <div className="spinner" />
      <p>טוען תרגילים...</p>
    </div>
  );

  if (error) return (
    <div className="session-error">
      <p>שגיאה: {error}</p>
      <button onClick={onBack}>חזור</button>
    </div>
  );

  // Interactive workbook: teaching pages + worked example, then the practice.
  if (workbook && bookPage < (workbook.pages || []).length) return (
    <WorkbookPage
      workbook={workbook}
      page={workbook.pages[bookPage]}
      pageIndex={bookPage}
      total={workbook.pages.length}
      childName={childName}
      onNext={() => setBookPage(p => p + 1)}
    />
  );

  // A new topic opens with its mini-lesson (learning before practising).
  if (lesson) return (
    <LessonCard lesson={lesson} childName={childName} onStart={() => setLesson(null)} />
  );

  // Mid-exercise "teach me" — re-learn the method, then return to the question.
  if (helpLesson) return (
    <LessonCard lesson={helpLesson} childName={childName} onStart={() => setHelpLesson(null)} />
  );

  // Nothing left to practise – every mistake was already conquered.
  if (practice && exercises.length === 0) return (
    <div className="session-error">
      <p>🏆 אין תרגילים לתרגל — כל הטעויות תוקנו, כל הכבוד!</p>
      <button onClick={onBack}>חזרה</button>
    </div>
  );

  if (done) return (
    <ResultScreen
      childName={childName}
      results={results}
      exercises={exercises}
      progress={progress}
      planStatus={planStatus}
      newSticker={sticker}
      onBack={onBack}
    />
  );

  const ex = exercises[current];
  // The current exercise's topic lesson (for the mid-exercise "teach me" button).
  const exFamily = ex ? familyKeyForType(ex.type) : null;
  const teachable = exFamily && LESSONS[exFamily]
    ? { key: exFamily, ...LESSONS[exFamily], help: true }
    : null;

  return (
    <div className="session">
      <div className="session-header">
        <div className="session-nav">
          <button className="nav-btn exit" onClick={() => setConfirmExit(true)}>
            ✖ יציאה
          </button>
          <button className="nav-btn prev" onClick={goPrev} disabled={current === 0}>
            ↩ שאלה קודמת
          </button>
        </div>
        <div className="session-progress">
          <span>
            {practice && <span className="review-badge">🔁 תרגול טעויות</span>}
            {childName} – שאלה {current + 1} מתוך {exercises.length}
            {ex?.isReview && <span className="review-badge">🔁 חזרה</span>}
          </span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(current / exercises.length) * 100}%` }} />
          </div>
        </div>
        <div className="attempt-badges">
          {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
            <div key={i} className={`attempt-dot ${i < attempts ? 'used' : ''}`} />
          ))}
        </div>
      </div>

      <ExerciseCard
        exercise={ex}
        child={child}
        subject={subject}
        onAnswer={handleAnswer}
        onTeach={teachable ? () => setHelpLesson(teachable) : undefined}
        feedback={feedback}
        showHint={showHint}
        attempts={attempts}
        maxAttempts={MAX_ATTEMPTS}
      />

      {confirmExit && (
        <div className="book-choice-overlay" onClick={() => setConfirmExit(false)}>
          <div className="book-choice" onClick={e => e.stopPropagation()}>
            <div className="book-choice-icon">🤔</div>
            <h3 className="book-choice-title">לצאת מהתרגול?</h3>
            <p className="exit-note">התרגילים שפתרת עכשיו לא יישמרו.</p>
            <button className="book-choice-btn drill" onClick={onBack}>
              <span>✖ כן, יוצאים</span>
              <small>חוזרים למסך הראשי</small>
            </button>
            <button className="book-choice-cancel" onClick={() => setConfirmExit(false)}>
              ממשיכים לתרגל 💪
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
