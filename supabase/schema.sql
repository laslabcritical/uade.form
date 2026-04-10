create extension if not exists pgcrypto;

create table if not exists public.research_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  respondent_name text not null,
  respondent_email text,
  q1 boolean not null,
  q2 boolean not null,
  q3 boolean not null,
  q4 boolean not null,
  q5 boolean not null,
  q6 boolean not null,
  source text not null default 'github-pages'
);

alter table public.research_responses enable row level security;

drop policy if exists "Allow public insert for research responses" on public.research_responses;
create policy "Allow public insert for research responses"
on public.research_responses
for insert
to anon
with check (
  char_length(trim(respondent_name)) between 2 and 120
  and coalesce(char_length(trim(respondent_email)), 0) <= 160
  and source = 'github-pages'
);

