'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Visual = {
  type: 'none' | 'triangle' | 'rectangle' | 'square' | 'circle' | 'angle' | 'grid' | 'fraction_bar' | 'number_line'
  labels?: string[]
  show_right_angle?: boolean
}

type Question = {
  id: string
  category: string
  skill?: string
  difficulty?: string
  text: string
  options: string[]
  correct_answer: string
  explanation?: string
  diagnostic_goal?: string
  misconception_checked?: string
  remediation_hint?: string
  visual?: Visual
}

type DiagnosticAnalysis = {
  level: string
  summary: string
  strengths: string[]
  weaknesses: string[]
  recommendation: string
  parent_explanation: string
  remediation_plan: string[]
  next_step: string
}

const QUESTIONS_PER_BATCH = 5
const TOTAL_BATCHES = 4
const TOTAL_TARGET_QUESTIONS = QUESTIONS_PER_BATCH * TOTAL_BATCHES

const fallbackQuestions: Question[] = [
  {
    id: 'q1',
    category: 'Calcul mental',
    skill: 'Addition',
    difficulty: 'facile',
    text: 'Quel est le résultat de 12 + 8 ?',
    options: ['18', '20', '16', '22'],
    correct_answer: '20',
    explanation: '12 + 8 = 20.',
    diagnostic_goal: "Vérifier la maîtrise d'une addition simple.",
    misconception_checked: 'Erreur de calcul mental ou addition incomplète.',
    remediation_hint: 'Reprendre les additions en décomposant 12 + 8 en 10 + 10.',
    visual: { type: 'none' },
  },
  {
    id: 'q2',
    category: 'Géométrie',
    skill: 'Reconnaissance des figures',
    difficulty: 'facile',
    text: 'Observe la figure. Quelle est sa nature ?',
    options: ['Triangle', 'Carré', 'Cercle', 'Rectangle'],
    correct_answer: 'Triangle',
    explanation: 'La figure possède trois côtés.',
    diagnostic_goal: "Vérifier la reconnaissance d'une figure par ses côtés.",
    misconception_checked: 'Confusion entre les figures géométriques de base.',
    remediation_hint: 'Revoir les figures en comptant les côtés et les sommets.',
    visual: { type: 'triangle', labels: ['A', 'B', 'C'] },
  },
  {
    id: 'q3',
    category: 'Logique',
    skill: 'Problème multiplicatif',
    difficulty: 'moyen',
    text: 'Si un élève lit 5 pages par heure, combien de pages lit-il en 3 heures ?',
    options: ['15', '12', '18', '10'],
    correct_answer: '15',
    explanation: '5 × 3 = 15.',
    diagnostic_goal: 'Vérifier la compréhension de la multiplication comme addition répétée.',
    misconception_checked: 'Confusion entre addition simple et multiplication.',
    remediation_hint: 'Représenter 3 groupes de 5 objets puis compter le total.',
    visual: { type: 'none' },
  },
]

const languages = [
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
]

const levels = [
  { value: '1AP', label: '1ère année primaire' },
  { value: '4AP', label: '4ème année primaire' },
  { value: '5AP', label: '5ème année primaire' },
  { value: '6AP', label: '6ème année primaire' },
  { value: '7B', label: '7ème année fondamentale' },
  { value: '1S', label: '1ère année secondaire' },
]

const subjects = ['Mathématiques', 'Français', 'Arabe', 'Sciences', 'Anglais']

function GeometryFigure({ visual }: { visual?: Visual }) {
  if (!visual || visual.type === 'none') {
    return null
  }

  const labels = visual.labels || ['A', 'B', 'C']

  return (
    <div className="visual-box" aria-label="Figure de la question">
      <svg viewBox="0 0 320 220" role="img">
        {visual.type === 'triangle' && (
          <>
            <polygon points="72,170 132,48 248,170" />
            <text x="58" y="190">{labels[0] || 'A'}</text>
            <text x="122" y="38">{labels[1] || 'B'}</text>
            <text x="254" y="190">{labels[2] || 'C'}</text>
            {visual.show_right_angle && <path d="M72 150 L92 150 L92 170" />}
          </>
        )}
        {visual.type === 'rectangle' && (
          <>
            <rect x="62" y="58" width="196" height="110" rx="3" />
            <text x="48" y="52">A</text>
            <text x="260" y="52">B</text>
            <text x="262" y="188">C</text>
            <text x="48" y="188">D</text>
          </>
        )}
        {visual.type === 'square' && (
          <>
            <rect x="92" y="42" width="136" height="136" rx="3" />
            <text x="78" y="38">A</text>
            <text x="232" y="38">B</text>
            <text x="232" y="196">C</text>
            <text x="78" y="196">D</text>
          </>
        )}
        {visual.type === 'circle' && (
          <>
            <circle cx="160" cy="110" r="68" />
            <line x1="160" y1="110" x2="228" y2="110" />
            <text x="150" y="103">O</text>
          </>
        )}
        {visual.type === 'angle' && (
          <>
            <line x1="82" y1="164" x2="240" y2="164" />
            <line x1="82" y1="164" x2="176" y2="58" />
            <path d="M118 164 A36 36 0 0 0 106 137" />
            <text x="66" y="186">A</text>
            <text x="244" y="170">B</text>
            <text x="178" y="52">C</text>
          </>
        )}
        {visual.type === 'grid' && (
          <>
            {Array.from({ length: 7 }).map((_, index) => (
              <line key={`v-${index}`} x1={70 + index * 30} y1="34" x2={70 + index * 30} y2="184" />
            ))}
            {Array.from({ length: 6 }).map((_, index) => (
              <line key={`h-${index}`} x1="70" y1={34 + index * 30} x2="250" y2={34 + index * 30} />
            ))}
          </>
        )}
      </svg>
    </div>
  )
}

function TransitionScreen({ currentBatch }: { currentBatch: number }) {
  const nextBatch = Math.min(currentBatch + 1, TOTAL_BATCHES)

  return (
    <div className="transition-screen" role="status" aria-live="polite">
      <div className="transition-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <span className="transition-kicker">Lot {nextBatch}/{TOTAL_BATCHES}</span>
      <h2>Préparation du prochain défi...</h2>
      <p>Nous analysons tes réponses pour choisir des questions adaptées à ton niveau.</p>
      <div className="transition-steps">
        <span className="done">Réponses reçues</span>
        <span className="done">Analyse en cours</span>
        <span>Nouveau lot</span>
      </div>
      <div className="transition-bar" aria-hidden="true">
        <span />
      </div>
    </div>
  )
}

export default function Home() {
  const [studentName, setStudentName] = useState('')
  const [studentAge, setStudentAge] = useState('')
  const [schoolLevel, setSchoolLevel] = useState('')
  const [subject, setSubject] = useState('Mathématiques')
  const [language, setLanguage] = useState('ar')
  const [stage, setStage] = useState<'setup' | 'quiz' | 'result'>('setup')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentBatch, setCurrentBatch] = useState(0)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [generationNote, setGenerationNote] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<DiagnosticAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const currentQuestion = questions[questionIndex]
  const answeredCount = Object.keys(answers).length
  const progress = Math.min((answeredCount / TOTAL_TARGET_QUESTIONS) * 100, 100)
  const canStart = Boolean(studentName.trim() && studentAge && schoolLevel && subject)
  const isArabic = language === 'ar'
  const isLastAvailableQuestion = questionIndex === questions.length - 1
  const canGenerateNextBatch = isLastAvailableQuestion && currentBatch < TOTAL_BATCHES

  const score = useMemo(() => {
    return questions.reduce((acc, question) => {
      return acc + (answers[question.id] === question.correct_answer ? 1 : 0)
    }, 0)
  }, [answers, questions])

  const buildResults = (questionList = questions, answerList = answers) => {
    return questionList.map(question => ({
      category: question.category,
      skill: question.skill,
      difficulty: question.difficulty,
      question: question.text,
      student_answer: answerList[question.id],
      correct_answer: question.correct_answer,
      correct: answerList[question.id] === question.correct_answer,
      diagnostic_goal: question.diagnostic_goal,
      misconception_checked: question.misconception_checked,
      remediation_hint: question.remediation_hint,
    }))
  }

  const generateQuestionBatch = async (batchNumber: number, previousQuestions = questions, previousAnswers = answers) => {
    setIsGenerating(true)
    setGenerationNote(null)

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentAge: Number(studentAge),
          schoolLevel,
          subject,
          language,
          questionCount: QUESTIONS_PER_BATCH,
          iteration: batchNumber,
          totalIterations: TOTAL_BATCHES,
          previousResults: buildResults(previousQuestions, previousAnswers),
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.questions?.length) {
        throw new Error(data.error || 'Questions non générées.')
      }

      const nextQuestions = data.questions.map((question: Question, index: number) => ({
        ...question,
        id: `lot-${batchNumber}-${question.id || index + 1}`,
      }))

      if (batchNumber === 1) {
        setQuestions(nextQuestions)
        setQuestionIndex(0)
        setAnswers({})
      } else {
        setQuestions(prev => [...prev, ...nextQuestions])
        setQuestionIndex(previousQuestions.length)
      }

      setCurrentBatch(batchNumber)

      if (data.source === 'fallback') {
        setGenerationNote(data.warning || 'Questions locales utilisées.')
      }
    } catch (error) {
      const localQuestions = fallbackQuestions.map((question, index) => ({
        ...question,
        id: `fallback-${batchNumber}-${index + 1}`,
      }))

      if (batchNumber === 1) {
        setQuestions(localQuestions)
        setQuestionIndex(0)
        setAnswers({})
      } else {
        setQuestions(prev => [...prev, ...localQuestions])
        setQuestionIndex(previousQuestions.length)
      }

      setCurrentBatch(batchNumber)
      setGenerationNote(error instanceof Error ? error.message : 'Questions locales utilisées.')
    } finally {
      setIsGenerating(false)
      setStage('quiz')
    }
  }

  const startDiagnostic = async () => {
    if (!canStart) {
      setGenerationNote("Merci de remplir le nom, l'âge, le niveau scolaire et la matière avant de commencer.")
      return
    }

    await generateQuestionBatch(1, [], {})
  }

  const generateNextBatch = async () => {
    await generateQuestionBatch(currentBatch + 1, questions, answers)
  }

  const handleAnswer = (option: string) => {
    if (!currentQuestion) {
      return
    }

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
    setIsAnalyzing(true)
    setSaveError(null)

    const results = buildResults()

    fetch('/api/analyze-diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName,
        studentAge: Number(studentAge),
        schoolLevel,
        subject,
        language,
        score,
        totalQuestions: questions.length,
        results,
      }),
    })
      .then(response => response.json())
      .then(data => setAnalysis(data.analysis || null))
      .catch(() => setAnalysis(null))
      .finally(() => setIsAnalyzing(false))

    if (!supabase) {
      setSaveError("Supabase n'est pas configuré. Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.")
      setIsSubmitting(false)
      return
    }

    try {
      const diagnosticPayload = {
        student_name: studentName,
        student_age: Number(studentAge),
        school_level: schoolLevel,
        subject,
        language,
        answers,
        score,
        total_questions: questions.length,
      }

      let response = await supabase
        .from('diagnostics')
        .insert([diagnosticPayload])
        .select('id')
        .single()

      if (response.error?.message.includes("'subject' column")) {
        const { subject: _subject, ...payloadWithoutSubject } = diagnosticPayload
        response = await supabase
          .from('diagnostics')
          .insert([payloadWithoutSubject])
          .select('id')
          .single()
      }

      if (response.error) {
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
    setQuestions([])
    setCurrentBatch(0)
    setSavedId(null)
    setSaveError(null)
    setGenerationNote(null)
    setAnalysis(null)
    setIsAnalyzing(false)
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
          <span className="eyebrow">Diagnostic intelligent Mind's Up</span>
          <h1>Révéler le vrai potentiel de chaque élève, question après question.</h1>
          <p>
            Chez Mind's Up, chaque diagnostic s'adapte aux réponses de l'élève pour repérer ses acquis, comprendre ses difficultés
            et proposer une remédiation claire, utile et alignée avec son niveau scolaire.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#diagnostic">Commencer</a>
            <span className="trust-note">Analyse IA personnalisée</span>
          </div>
        </div>

        <aside className="hero-panel" aria-label="Aperçu du diagnostic">
          <div className="panel-header">
            <span>Progression</span>
            <strong>{answeredCount}/{TOTAL_TARGET_QUESTIONS}</strong>
          </div>
          <div className="mini-progress">
            <span style={{ width: `${stage === 'setup' ? 8 : progress}%` }} />
          </div>
          <div className="metric-row">
            <div>
              <small>Lot</small>
              <strong>{currentBatch || 1}/{TOTAL_BATCHES}</strong>
            </div>
            <div>
              <small>Matière</small>
              <strong>{subject}</strong>
            </div>
          </div>
          <div className="category-list">
            {(questions.length ? questions : fallbackQuestions).map((question, index) => (
              <span key={`${question.id}-${index}`} className={answers[question.id] ? 'done' : ''}>
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
            <span>4 lots adaptatifs</span>
          </div>
          <div className={`step ${stage === 'result' ? 'current' : ''}`}>
            <strong>3</strong>
            <span>Rapport parent</span>
          </div>
        </aside>

        {stage === 'setup' && (
          <section className="card">
            <div className="section-head">
              <span>01</span>
              <div>
                <h2>Préparation du diagnostic</h2>
                <p>Renseignez le profil. Le test générera 4 lots de 5 questions, chacun adapté aux réponses précédentes.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field wide">
                <label htmlFor="studentName">Nom de l'élève</label>
                <input id="studentName" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Exemple : Youssef" />
              </div>
              <div className="field">
                <label htmlFor="studentAge">Âge</label>
                <input id="studentAge" type="number" min={5} max={22} value={studentAge} onChange={e => setStudentAge(e.target.value)} placeholder="12" />
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
              <div className="field">
                <label htmlFor="subject">Matière</label>
                <select id="subject" value={subject} onChange={e => setSubject(e.target.value)}>
                  {subjects.map(item => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="language-row">
              <span>Langue du test</span>
              <div className="segmented">
                {languages.map(lang => (
                  <button key={lang.code} className={language === lang.code ? 'active' : ''} type="button" onClick={() => setLanguage(lang.code)}>
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="notice">
              Après chaque lot, les réponses sont envoyées à Gemini pour orienter le lot suivant vers les lacunes possibles.
            </div>

            {generationNote && <div className="notice compact error">{generationNote}</div>}

            <div className="actions">
              <button className="button primary" type="button" onClick={startDiagnostic} disabled={isGenerating}>
                {isGenerating ? 'Génération du lot 1...' : 'Générer le diagnostic'}
              </button>
            </div>
          </section>
        )}

        {stage === 'quiz' && currentQuestion && (
          <section className="card">
            {isGenerating ? (
              <TransitionScreen currentBatch={currentBatch} />
            ) : (
              <>
                <div className="quiz-top">
                  <div>
                    <span className="question-meta">Lot {currentBatch}/{TOTAL_BATCHES} · {currentQuestion.category}</span>
                    <h2>Question {questionIndex + 1} sur {TOTAL_TARGET_QUESTIONS}</h2>
                  </div>
                  <div className="student-badge">{studentName || 'Élève'}</div>
                </div>

                {generationNote && <div className="notice compact">{generationNote}</div>}

                <div className="progress-bar">
                  <span style={{ width: `${progress}%` }} />
                </div>

                <article className={`question-card ${isArabic ? 'rtl-content' : ''}`} dir={isArabic ? 'rtl' : 'ltr'}>
                  <GeometryFigure visual={currentQuestion.visual} />
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
                  <button className="button secondary" type="button" onClick={handlePrev} disabled={questionIndex === 0 || isGenerating}>
                    Précédent
                  </button>
                  {!isLastAvailableQuestion && (
                    <button className="button primary" type="button" onClick={handleNext} disabled={!answers[currentQuestion.id] || isGenerating}>
                      Suivant
                    </button>
                  )}
                  {canGenerateNextBatch && (
                    <button className="button primary" type="button" onClick={generateNextBatch} disabled={!answers[currentQuestion.id] || isGenerating}>
                      Générer le lot {currentBatch + 1}
                    </button>
                  )}
                  {isLastAvailableQuestion && currentBatch === TOTAL_BATCHES && (
                    <button className="button success" type="button" onClick={handleSubmit} disabled={answeredCount < questions.length || isSubmitting}>
                      {isSubmitting ? 'Enregistrement...' : 'Terminer'}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {stage === 'result' && (
          <section id="resultats" className={`card ${isArabic ? 'rtl-content' : ''}`} dir={isArabic ? 'rtl' : 'ltr'}>
            <div className="section-head">
              <span>03</span>
              <div>
                <h2>Résultat du diagnostic</h2>
                <p>Rapport synthétique prêt à partager avec le parent.</p>
              </div>
            </div>

            <div className="score-card">
              <div>
                <span>Score obtenu</span>
                <strong>{score}/{questions.length}</strong>
              </div>
              <p>Le score est interprété avec les compétences testées, les erreurs observées et les pistes de remédiation.</p>
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
                <span>Matière</span>
                <strong>{subject}</strong>
              </div>
              <div className="kpi">
                <span>Lots réalisés</span>
                <strong>{currentBatch}/{TOTAL_BATCHES}</strong>
              </div>
            </div>

            <div className="analysis-card">
              <div className="analysis-head">
                <span>Diagnostic pédagogique</span>
                <strong>{isAnalyzing ? 'Analyse...' : analysis?.level || 'En attente'}</strong>
              </div>
              {analysis ? (
                <>
                  <p>{analysis.summary}</p>
                  <p className="parent-explanation">{analysis.parent_explanation}</p>
                  <div className="analysis-grid">
                    <div>
                      <span>Points forts</span>
                      {analysis.strengths.map(item => (
                        <strong key={item}>{item}</strong>
                      ))}
                    </div>
                    <div>
                      <span>À travailler</span>
                      {analysis.weaknesses.map(item => (
                        <strong key={item}>{item}</strong>
                      ))}
                    </div>
                  </div>
                  <div className="remediation-block">
                    <span>Plan de remédiation</span>
                    {analysis.remediation_plan.map(item => (
                      <strong key={item}>{item}</strong>
                    ))}
                  </div>
                  <p className="recommendation">{analysis.recommendation}</p>
                  <p className="next-step">{analysis.next_step}</p>
                </>
              ) : (
                <p>{isAnalyzing ? 'Analyse des réponses en cours.' : "L'analyse n'a pas pu être générée."}</p>
              )}
            </div>

            {saveError && <div className="notice error">Résultat non sauvegardé : {saveError}</div>}

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
