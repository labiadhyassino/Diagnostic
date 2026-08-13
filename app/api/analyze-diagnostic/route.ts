import { NextResponse } from 'next/server'
import { buildAnalysisPrompt } from '../../../lib/prompts'

type AnalyzeRequest = {
  studentName?: string
  studentAge?: number
  schoolLevel?: string
  subject?: string
  language?: string
  score?: number
  totalQuestions?: number
  results?: Array<{
    category?: string
    skill?: string
    difficulty?: string
    question: string
    student_answer?: string
    correct_answer: string
    correct: boolean
    diagnostic_goal?: string
    misconception_checked?: string
    remediation_hint?: string
  }>
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

const analysisResponseSchema = {
  type: 'object',
  properties: {
    level: { type: 'string', enum: ['Bon', 'Moyen', 'À consolider'] },
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    weaknesses: { type: 'array', items: { type: 'string' } },
    recommendation: { type: 'string' },
    parent_explanation: { type: 'string' },
    remediation_plan: { type: 'array', items: { type: 'string' } },
    next_step: { type: 'string' },
  },
  required: ['level', 'summary', 'strengths', 'weaknesses', 'recommendation', 'parent_explanation', 'remediation_plan', 'next_step'],
}

function buildLocalAnalysis(body: AnalyzeRequest): DiagnosticAnalysis {
  const total = body.totalQuestions || body.results?.length || 1
  const score = body.score || 0
  const ratio = score / total
  const correctSkills = (body.results || [])
    .filter(result => result.correct)
    .map(result => result.skill || result.category || 'Compétence réussie')
  const weakSkills = (body.results || [])
    .filter(result => !result.correct)
    .map(result => result.misconception_checked || result.skill || result.category || 'Compétence à revoir')
  const remediation = (body.results || []).find(result => !result.correct)?.remediation_hint

  const strengths = Array.from(new Set(correctSkills)).slice(0, 2)
  const weaknesses = Array.from(new Set(weakSkills)).slice(0, 2)

  if (ratio >= 0.75) {
    return {
      level: 'Bon',
      summary: `L'élève réussit ${score}/${total} questions. Les bases semblent solides dans cette matière.`,
      strengths: strengths.length ? strengths : ['Bonne maîtrise générale', 'Réponses majoritairement correctes'],
      weaknesses: weaknesses.length ? weaknesses : ['Approfondir avec des questions plus difficiles'],
      recommendation: 'Proposer un mini-test plus avancé pour confirmer le niveau et affiner les besoins.',
      parent_explanation: "L'élève répond correctement à la majorité des questions. Il peut poursuivre avec des exercices plus exigeants.",
      remediation_plan: ['Renforcer les compétences réussies avec des exercices variés', 'Vérifier les erreurs restantes avec un mini-test ciblé'],
      next_step: 'Passer à un niveau de difficulté supérieur sur les mêmes compétences.',
    }
  }

  if (ratio >= 0.45) {
    return {
      level: 'Moyen',
      summary: `L'élève réussit ${score}/${total} questions. Le niveau est partiel avec des compétences encore instables.`,
      strengths: strengths.length ? strengths : ['Quelques réponses correctes', 'Compréhension partielle des consignes'],
      weaknesses: weaknesses.length ? weaknesses : ['Revoir les notions où les réponses sont incorrectes'],
      recommendation: remediation || 'Reprendre les erreurs une par une, puis refaire 3 à 5 exercices ciblés.',
      parent_explanation: "L'élève possède des bases, mais certaines notions ne sont pas encore stables. Un travail ciblé peut améliorer rapidement le résultat.",
      remediation_plan: [remediation || 'Reprendre les erreurs une par une', 'Refaire 3 à 5 exercices courts sur chaque lacune'],
      next_step: 'Programmer une séance de remédiation courte puis refaire un lot de validation.',
    }
  }

  return {
    level: 'À consolider',
    summary: `L'élève réussit ${score}/${total} questions. Les notions évaluées doivent être reprises progressivement.`,
    strengths: strengths.length ? strengths : ['A démarré le diagnostic', 'Profil de départ identifié'],
    weaknesses: weaknesses.length ? weaknesses : ['Bases de la matière à renforcer'],
    recommendation: remediation || 'Commencer par des exercices simples sur les compétences non réussies avant de passer au niveau suivant.',
    parent_explanation: "L'élève a besoin de reprendre progressivement les bases évaluées avant d'aborder des exercices plus complexes.",
    remediation_plan: [remediation || 'Reprendre les prérequis essentiels', 'Utiliser des exercices très guidés puis augmenter la difficulté'],
    next_step: 'Commencer par une séance de reprise des bases, puis refaire un diagnostic court.',
  }
}

function extractJson(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  return JSON.parse(fenced ? fenced[1] : trimmed)
}

function cleanAnalysis(value: Partial<DiagnosticAnalysis>, fallback: DiagnosticAnalysis): DiagnosticAnalysis {
  return {
    level: value.level || fallback.level,
    summary: value.summary || fallback.summary,
    strengths: Array.isArray(value.strengths) && value.strengths.length ? value.strengths.slice(0, 3) : fallback.strengths,
    weaknesses: Array.isArray(value.weaknesses) && value.weaknesses.length ? value.weaknesses.slice(0, 3) : fallback.weaknesses,
    recommendation: value.recommendation || fallback.recommendation,
    parent_explanation: value.parent_explanation || fallback.parent_explanation,
    remediation_plan:
      Array.isArray(value.remediation_plan) && value.remediation_plan.length ? value.remediation_plan.slice(0, 4) : fallback.remediation_plan,
    next_step: value.next_step || fallback.next_step,
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const body = (await request.json()) as AnalyzeRequest
  const localAnalysis = buildLocalAnalysis(body)

  if (!apiKey || apiKey === 'your-gemini-api-key') {
    return NextResponse.json({ analysis: localAnalysis, source: 'fallback' })
  }

  const prompt = buildAnalysisPrompt({
    studentName: body.studentName,
    studentAge: body.studentAge,
    schoolLevel: body.schoolLevel,
    subject: body.subject,
    language: body.language,
    score: body.score,
    totalQuestions: body.totalQuestions,
    results: body.results || [],
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
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          responseSchema: analysisResponseSchema,
        },
      }),
    })

    if (!response.ok) {
      console.error('Gemini analysis error', response.status, await response.text())
      return NextResponse.json({ analysis: localAnalysis, source: 'fallback' })
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      return NextResponse.json({ analysis: localAnalysis, source: 'fallback' })
    }

    return NextResponse.json({ analysis: cleanAnalysis(extractJson(text), localAnalysis), source: 'gemini' })
  } catch (error) {
    console.error('Gemini analysis failed', error)
    return NextResponse.json({ analysis: localAnalysis, source: 'fallback' })
  }
}
