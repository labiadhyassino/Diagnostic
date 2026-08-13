import { NextResponse } from 'next/server'
import { buildQuestionPrompt } from '../../../lib/prompts'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

type GenerateRequest = {
  studentAge?: number
  schoolLevel?: string
  subject?: string
  language?: string
  questionCount?: number
  iteration?: number
  totalIterations?: number
  previousResults?: unknown[]
}

type GeneratedQuestion = {
  id: string
  category: string
  skill: string
  difficulty: 'facile' | 'moyen' | 'difficile'
  text: string
  options: string[]
  correct_answer: string
  explanation: string
  diagnostic_goal?: string
  misconception_checked?: string
  remediation_hint?: string
  visual?: {
    type: 'none' | 'triangle' | 'rectangle' | 'square' | 'circle' | 'angle' | 'grid' | 'fraction_bar' | 'number_line'
    variant?: string
    labels?: string[]
    values?: number[]
    show_right_angle?: boolean
  }
}

const allowedVisualTypes = new Set([
  'none',
  'triangle',
  'rectangle',
  'square',
  'circle',
  'angle',
  'grid',
  'fraction_bar',
  'number_line',
])

const questionResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      category: { type: 'string' },
      skill: { type: 'string' },
      difficulty: { type: 'string', enum: ['facile', 'moyen', 'difficile'] },
      text: { type: 'string' },
      options: { type: 'array', items: { type: 'string' } },
      correct_answer: { type: 'string' },
      explanation: { type: 'string' },
      diagnostic_goal: { type: 'string' },
      misconception_checked: { type: 'string' },
      remediation_hint: { type: 'string' },
      visual: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['none', 'triangle', 'rectangle', 'square', 'circle', 'angle', 'grid', 'fraction_bar', 'number_line'],
          },
          variant: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
          values: { type: 'array', items: { type: 'number' } },
          show_right_angle: { type: 'boolean' },
        },
      },
    },
    required: [
      'id',
      'category',
      'skill',
      'difficulty',
      'text',
      'options',
      'correct_answer',
      'explanation',
      'diagnostic_goal',
      'misconception_checked',
      'remediation_hint',
      'visual',
    ],
  },
}

const fallbackQuestions: GeneratedQuestion[] = [
  {
    id: 'fallback-math-1',
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
    id: 'fallback-math-2',
    category: 'Géométrie',
    skill: 'Reconnaissance des figures',
    difficulty: 'facile',
    text: 'Observe la figure. Quelle est sa nature ?',
    options: ['Triangle', 'Carré', 'Cercle', 'Rectangle'],
    correct_answer: 'Triangle',
    explanation: 'La figure possède trois côtés, c’est donc un triangle.',
    diagnostic_goal: "Vérifier la reconnaissance d'une figure par ses côtés.",
    misconception_checked: 'Confusion entre les figures géométriques de base.',
    remediation_hint: 'Revoir les figures en comptant les côtés et les sommets.',
    visual: { type: 'triangle', labels: ['A', 'B', 'C'] },
  },
  {
    id: 'fallback-math-3',
    category: 'Logique',
    skill: 'Problème multiplicatif',
    difficulty: 'moyen',
    text: 'Si un élève lit 5 pages par heure, combien de pages lit-il en 3 heures ?',
    options: ['15', '12', '18', '10'],
    correct_answer: '15',
    explanation: '5 pages × 3 heures = 15 pages.',
    diagnostic_goal: 'Vérifier la compréhension de la multiplication comme addition répétée.',
    misconception_checked: 'Confusion entre addition simple et multiplication.',
    remediation_hint: 'Représenter 3 groupes de 5 objets puis compter le total.',
    visual: { type: 'none' },
  },
]

const curriculumHints: Record<string, string> = {
  '1AP-Mathématiques':
    'Nombres simples, comparaison, addition et soustraction très simples, formes géométriques de base, consignes courtes.',
  '4AP-Mathématiques':
    'Nombres entiers, calcul mental, addition, soustraction, multiplication, problèmes simples, mesures, figures géométriques de base.',
  '7B-Mathématiques':
    'Nombres entiers et décimaux, fractions simples, proportionnalité introductive, géométrie plane, angles et périmètres.',
  '1S-Mathématiques':
    'Calcul algébrique de base, équations simples, fonctions introductives, géométrie plane, raisonnement logique.',
  '1AP-Français': 'Lecture de mots simples, compréhension orale/écrite courte, vocabulaire de base.',
  '4AP-Français': 'Compréhension de texte court, vocabulaire, grammaire simple, conjugaison de base.',
  '1S-Français': 'Compréhension de texte, vocabulaire, grammaire, conjugaison, expression écrite courte.',
}

function fallback(warning: string, status = 200) {
  return NextResponse.json({ questions: fallbackQuestions, source: 'fallback', warning }, { status })
}

function cleanQuestion(question: GeneratedQuestion, index: number): GeneratedQuestion | null {
  if (!question || typeof question.text !== 'string' || !Array.isArray(question.options)) {
    return null
  }

  const options = question.options.filter(option => typeof option === 'string' && option.trim()).slice(0, 4)
  if (options.length !== 4 || !options.includes(question.correct_answer)) {
    return null
  }

  const visualType = question.visual?.type && allowedVisualTypes.has(question.visual.type) ? question.visual.type : 'none'

  return {
    id: question.id || `gemini-${index + 1}`,
    category: question.category || 'Diagnostic',
    skill: question.skill || question.category || 'Compétence',
    difficulty: question.difficulty || 'facile',
    text: question.text,
    options,
    correct_answer: question.correct_answer,
    explanation: question.explanation || '',
    diagnostic_goal: question.diagnostic_goal || 'Vérifier une compétence ciblée.',
    misconception_checked: question.misconception_checked || 'Erreur à analyser selon la réponse donnée.',
    remediation_hint: question.remediation_hint || 'Reprendre la compétence avec des exercices courts et progressifs.',
    visual: { ...question.visual, type: visualType },
  }
}

function extractJson(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  return JSON.parse(fenced ? fenced[1] : trimmed)
}

async function saveGeneratedQuestions(input: {
  questions: GeneratedQuestion[]
  schoolLevel: string
  subject: string
  language: string
  iteration: number
  source: string
}) {
  if (!supabaseAdmin) {
    return
  }

  const rows = input.questions.map(question => ({
    external_id: question.id,
    school_level: input.schoolLevel,
    subject: input.subject,
    language: input.language,
    iteration: input.iteration,
    source: input.source,
    category: question.category,
    skill: question.skill,
    difficulty: question.difficulty,
    text: question.text,
    options: question.options,
    correct_answer: question.correct_answer,
    explanation: question.explanation,
    diagnostic_goal: question.diagnostic_goal,
    misconception_checked: question.misconception_checked,
    remediation_hint: question.remediation_hint,
    visual: question.visual,
  }))

  const { error } = await supabaseAdmin.from('generated_questions').insert(rows)

  if (error) {
    console.error('Failed to save generated questions', error)
  }
}

async function loadCurriculumContext(input: { schoolLevel: string; subject: string; languageCode: string }) {
  const fallbackContext = curriculumHints[`${input.schoolLevel}-${input.subject}`] || 'Respecter le niveau scolaire indiqué et le programme tunisien.'

  if (!supabaseAdmin) {
    console.log('[curriculum] Supabase admin unavailable, using fallback context', {
      level: input.schoolLevel,
      subject: input.subject,
      language: input.languageCode,
    })
    return fallbackContext
  }

  const { data, error } = await supabaseAdmin
    .from('curriculum_guides')
    .select('title, content_json')
    .eq('level', input.schoolLevel)
    .eq('subject', input.subject)
    .eq('language', input.languageCode)
    .maybeSingle()

  if (error) {
    console.error('Failed to load curriculum guide', error)
    console.log('[curriculum] Failed to load guide, using fallback context', {
      level: input.schoolLevel,
      subject: input.subject,
      language: input.languageCode,
    })
    return fallbackContext
  }

  if (!data?.content_json) {
    console.log('[curriculum] No matching guide found, using fallback context', {
      level: input.schoolLevel,
      subject: input.subject,
      language: input.languageCode,
    })
    return fallbackContext
  }

  console.log('[curriculum] Guide loaded and sent to Gemini prompt', {
    level: input.schoolLevel,
    subject: input.subject,
    language: input.languageCode,
    title: data.title,
    contentSize: JSON.stringify(data.content_json).length,
  })

  return JSON.stringify(
    {
      title: data.title,
      guide: data.content_json,
    },
    null,
    2,
  )
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const body = (await request.json()) as GenerateRequest

  const subject = body.subject || 'Mathématiques'
  const schoolLevel = body.schoolLevel || '4AP'
  const languageCode = body.language || 'ar'
  const language = languageCode === 'ar' ? 'arabe' : 'français'
  const questionCount = Math.min(Math.max(body.questionCount || 5, 3), 8)
  const iteration = body.iteration || 1
  const curriculum = await loadCurriculumContext({ schoolLevel, subject, languageCode })

  console.log('[gemini] Preparing question generation', {
    level: schoolLevel,
    subject,
    language: languageCode,
    iteration,
    questionCount,
    previousResultsCount: body.previousResults?.length || 0,
    curriculumChars: curriculum.length,
  })

  if (!apiKey || apiKey === 'your-gemini-api-key') {
    return fallback('GEMINI_API_KEY manquante ou invalide. Questions locales utilisées.')
  }

  const prompt = buildQuestionPrompt({
    studentAge: body.studentAge,
    schoolLevel,
    subject,
    language,
    questionCount,
    curriculum,
    iteration,
    totalIterations: body.totalIterations || 4,
    previousResults: body.previousResults || [],
  })

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema: questionResponseSchema,
        },
      }),
    })

    if (!response.ok) {
      console.error('Gemini API error', response.status, await response.text())
      return fallback(`Gemini n'a pas répondu correctement (${response.status}). Questions locales utilisées.`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      return fallback('Réponse Gemini vide. Questions locales utilisées.')
    }

    const parsed = extractJson(text)
    const questions = (Array.isArray(parsed) ? parsed : parsed.questions)
      .map((question: GeneratedQuestion, index: number) => cleanQuestion(question, index))
      .filter(Boolean)

    if (!questions.length) {
      return fallback('Aucune question Gemini valide. Questions locales utilisées.')
    }

    await saveGeneratedQuestions({
      questions,
      schoolLevel,
      subject,
      language,
      iteration,
      source: 'gemini',
    })

    return NextResponse.json({ questions, source: 'gemini' })
  } catch (error) {
    console.error('Gemini generation failed', error)
    return fallback('Réponse Gemini invalide. Questions locales utilisées.')
  }
}
