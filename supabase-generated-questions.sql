create table if not exists generated_questions (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  school_level text not null,
  subject text not null,
  language text not null,
  iteration integer not null,
  source text not null default 'gemini',
  category text not null,
  skill text not null,
  difficulty text not null,
  text text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text,
  diagnostic_goal text,
  misconception_checked text,
  remediation_hint text,
  visual jsonb,
  created_at timestamptz not null default now()
);

create index if not exists generated_questions_level_subject_idx
  on generated_questions (school_level, subject);

create index if not exists generated_questions_created_at_idx
  on generated_questions (created_at desc);
