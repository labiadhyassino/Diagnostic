'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Question = {
  id: string
  category: string
  text: string
  options: string[]
  correct_answer: string
}

const fallbackQuestions: Question[] = [
  {
    id: 'q1',
    category: 'Calcul mental',
    text: 'Quel est le résultat de 12 + 8 ?',
    options: ['18', '20', '16', '22'],
    correct_answer: '20',
  },
  {
    id: 'q2',
    category: 'Compréhension',
    text: 'Quel est le résultat de 9 × 3 ?',
    options: ['27', '24', '30', '21'],
    correct_answer: '27',
  },
  {
    id: 'q3',
    category: 'Logique',
    text: 'Si un élève lit 5 pages par heure, combien de pages lit-il en 3 heures ?',
    options: ['15', '12', '18', '10'],
    correct_answer: '15',
  },
]

const languages = [
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
]

const levels = [
  { value: '1AP', label: '1ère année primaire' },
  { value: '4AP', label: '4ème année primaire' },
  { value: '7B', label: '7ème année fondamentale' },
  { value: '1S', label: '1ère année secondaire' },
]

export default function Home() {
  const [studentName, setStudentName] = useState('')
  const [studentAge, setStudentAge] = useState('')
  const [schoolLevel, setSchoolLevel] = useState('')
  const [language, setLanguage] = useState('ar')
  const [stage, setStage] = useState<'setup' | 'quiz' | 'result'>('setup')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)
  const [questions, setQuestions] = useState<Question[]>(fallbackQuestions)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const currentQuestion = questions[questionIndex]
  const progress = ((questionIndex + 1) / questions.length) * 100
  const answeredCount = Object.keys(answers).length
  const canStart = studentName && studentAge && schoolLevel

  useEffect(() => {
    const loadQuestions = async () => {
      if (!supabase) {
        setIsLoadingQuestions(false)
        return
      }

      const response = await supabase
        .from('questions')
        .select('id, category, text, options, correct_answer')
        .order('created_at', { ascending: true })

      if (!response.error && response.data?.length) {
        setQuestions(response.data as Question[])
      }

      setIsLoadingQuestions(false)
    }

    loadQuestions()
  }, [])

  const score = useMemo(() => {
    return questions.reduce((acc, question) => {
      return acc + (answers[question.id] === question.correct_answer ? 1 : 0)
    }, 0)
  }, [answers, questions])

  const handleAnswer = (option: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: option }))
  }

  const handleNext = () => {
    if (questionIndex < questions.length - 1) {
      setQuestionIndex(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    if (questionIndex > 0) {
      setQuestionIndex(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    setStage('result')
    setIsSubmitting(true)
    setSaveError(null)

    if (!supabase) {
      setSaveError("Supabase n'est pas configuré. Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.")
      setIsSubmitting(false)
      return
    }

    try {
      const response = await supabase
        .from('diagnostics')
        .insert([
          {
            student_name: studentName,
            student_age: Number(studentAge),
            school_level: schoolLevel,
            language,
            answers,
            score,
            total_questions: questions.length,
          },
        ])
        .select('id')
        .single()

      if (response.error) {
        console.error(response.error)
        setSaveError(response.error.message)
      } else {
        setSavedId(response.data?.id ?? null)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetDiagnostic = () => {
    setStage('setup')
    setQuestionIndex(0)
    setAnswers({})
    setSavedId(null)
    setSaveError(null)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <Image className="logo-image" src="/logo.png" alt="Mind's Up" width={104} height={104} priority />
          <span>
            <small>Centre éducatif</small>
          </span>
        </a>
        <nav className="topnav" aria-label="Navigation principale">
          <a href="#diagnostic">Diagnostic</a>
          <a href="#resultats">Résultats</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Diagnostic élève en ligne</span>
          <h1>Identifier le niveau et les besoins de chaque élève.</h1>
          <p>
            Évaluez les acquis, repérez les difficultés et obtenez une synthèse claire pour orienter l'accompagnement pédagogique.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#diagnostic">Commencer</a>
            <span className="trust-note">Profil, questions, synthèse</span>
          </div>
        </div>

        <aside className="hero-panel" aria-label="Aperçu du diagnostic">
          <div className="panel-header">
            <span>Session active</span>
            <strong>{answeredCount}/{questions.length}</strong>
          </div>
          <div className="mini-progress">
            <span style={{ width: `${stage === 'setup' ? 18 : progress}%` }} />
          </div>
          <div className="metric-row">
            <div>
              <small>Durée estimée</small>
              <strong>5 min</strong>
            </div>
            <div>
              <small>Langues</small>
              <strong>AR / FR</strong>
            </div>
          </div>
          <div className="category-list">
            {questions.map((question, index) => (
              <span key={question.id} className={index <= questionIndex && stage !== 'setup' ? 'done' : ''}>
                {question.category}
              </span>
            ))}
          </div>
        </aside>
      </section>

      <section id="diagnostic" className="workspace">
        <aside className="sidebar">
          <span className="sidebar-label">Parcours</span>
          <div className={`step ${stage === 'setup' ? 'current' : 'complete'}`}>
            <strong>1</strong>
            <span>Profil élève</span>
          </div>
          <div className={`step ${stage === 'quiz' ? 'current' : stage === 'result' ? 'complete' : ''}`}>
            <strong>2</strong>
            <span>Questions</span>
          </div>
          <div className={`step ${stage === 'result' ? 'current' : ''}`}>
            <strong>3</strong>
            <span>Synthèse</span>
          </div>
        </aside>

        {stage === 'setup' && (
          <section className="card">
            <div className="section-head">
              <span>01</span>
              <div>
                <h2>Préparation du diagnostic</h2>
                <p>Renseignez les informations de l'élève avant de commencer la session.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field wide">
                <label htmlFor="studentName">Nom de l'élève</label>
                <input
                  id="studentName"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="Exemple : Youssef"
                />
              </div>
              <div className="field">
                <label htmlFor="studentAge">Âge</label>
                <input
                  id="studentAge"
                  type="number"
                  min={5}
                  max={22}
                  value={studentAge}
                  onChange={e => setStudentAge(e.target.value)}
                  placeholder="12"
                />
              </div>
              <div className="field">
                <label htmlFor="schoolLevel">Niveau scolaire</label>
                <select id="schoolLevel" value={schoolLevel} onChange={e => setSchoolLevel(e.target.value)}>
                  <option value="">Choisir le niveau</option>
                  {levels.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="language-row">
              <span>Langue du test</span>
              <div className="segmented">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    className={language === lang.code ? 'active' : ''}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="notice">
              Les réponses peuvent être enregistrées pour garder une trace claire des diagnostics.
            </div>

            <div className="actions">
              <button className="button primary" type="button" onClick={() => setStage('quiz')} disabled={!canStart || isLoadingQuestions}>
                {isLoadingQuestions ? 'Chargement...' : 'Commencer le diagnostic'}
              </button>
            </div>
          </section>
        )}

        {stage === 'quiz' && (
          <section className="card">
            <div className="quiz-top">
              <div>
                <span className="question-meta">{currentQuestion.category}</span>
                <h2>Question {questionIndex + 1} sur {questions.length}</h2>
              </div>
              <div className="student-badge">{studentName || 'Élève'}</div>
            </div>

            <div className="progress-bar">
              <span style={{ width: `${progress}%` }} />
            </div>

            <div className="timer-grid">
              <div className="timer">
                <span>Question</span>
                <strong>00:00</strong>
              </div>
              <div className="timer">
                <span>Total</span>
                <strong>00:00</strong>
              </div>
            </div>

            <article className="question-card" dir="auto">
              <p>{currentQuestion.text}</p>
              <div className="options">
                {currentQuestion.options.map(option => (
                  <button
                    key={option}
                    type="button"
                    className={`option ${answers[currentQuestion.id] === option ? 'selected' : ''}`}
                    onClick={() => handleAnswer(option)}
                  >
                    <span className="radio-dot" />
                    <span>{option}</span>
                  </button>
                ))}
              </div>
            </article>

            <div className="nav-row">
              <button className="button secondary" type="button" onClick={handlePrev} disabled={questionIndex === 0}>
                Précédent
              </button>
              {questionIndex < questions.length - 1 ? (
                <button className="button primary" type="button" onClick={handleNext} disabled={!answers[currentQuestion.id]}>
                  Suivant
                </button>
              ) : (
                <button
                  className="button success"
                  type="button"
                  onClick={handleSubmit}
                  disabled={answeredCount < questions.length || isSubmitting}
                >
                  {isSubmitting ? 'Enregistrement...' : 'Terminer'}
                </button>
              )}
            </div>
          </section>
        )}

        {stage === 'result' && (
          <section id="resultats" className="card">
            <div className="section-head">
              <span>03</span>
              <div>
                <h2>Résultat du diagnostic</h2>
                <p>Score total et retour synthétique pour l'élève.</p>
              </div>
            </div>

            <div className="score-card">
              <div>
                <span>Score obtenu</span>
                <strong>{score}/{questions.length}</strong>
              </div>
              <p>
                Ce diagnostic aide à repérer rapidement les besoins de l'élève et à orienter la suite de l'accompagnement.
              </p>
            </div>

            <div className="kpi-grid">
              <div className="kpi">
                <span>Nom</span>
                <strong>{studentName}</strong>
              </div>
              <div className="kpi">
                <span>Niveau</span>
                <strong>{schoolLevel}</strong>
              </div>
              <div className="kpi">
                <span>Langue</span>
                <strong>{language.toUpperCase()}</strong>
              </div>
              <div className="kpi">
                <span>Enregistrement</span>
                <strong>{savedId ? 'Sauvegardé' : saveError ? 'Erreur' : 'En cours...'}</strong>
              </div>
            </div>

            {saveError && (
              <div className="notice error">
                Résultat non sauvegardé : {saveError}
              </div>
            )}

            <div className="actions">
              <button className="button secondary" type="button" onClick={resetDiagnostic}>
                Nouveau diagnostic
              </button>
            </div>
          </section>
        )}
      </section>

      <footer>Mind's Up - Diagnostic élève</footer>
    </main>
  )
}
