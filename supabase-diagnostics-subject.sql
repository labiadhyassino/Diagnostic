alter table diagnostics
add column if not exists subject text;

alter table diagnostics
add column if not exists analysis jsonb;

create index if not exists diagnostics_subject_idx
  on diagnostics (subject);
