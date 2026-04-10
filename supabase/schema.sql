create extension if not exists pgcrypto;

drop view if exists public.research_responses;
drop table if exists public.research_response_events cascade;
drop table if exists public.research_responses cascade;

create table public.research_response_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submission_token uuid not null,
  event_type text not null check (event_type in ('profile', 'answer', 'submit')),
  question_key text check (
    question_key is null
    or question_key in ('q1', 'q2', 'q3', 'q4', 'q5', 'q6')
  ),
  answer boolean,
  respondent_name text,
  respondent_email text,
  source text not null default 'github-pages',
  is_complete boolean not null default false,
  constraint answer_event_shape check (
    (event_type = 'answer' and question_key is not null and answer is not null and is_complete = false)
    or (event_type = 'profile' and question_key is null and answer is null and is_complete = false)
    or (event_type = 'submit' and question_key is null and answer is null and is_complete = true)
  ),
  constraint respondent_name_length check (
    respondent_name is null
    or char_length(trim(respondent_name)) between 2 and 120
  ),
  constraint respondent_email_length check (
    respondent_email is null
    or char_length(trim(respondent_email)) <= 160
  )
);

create index research_response_events_submission_idx
on public.research_response_events (submission_token, created_at desc);

create index research_response_events_event_idx
on public.research_response_events (event_type, created_at desc);

alter table public.research_response_events enable row level security;

drop policy if exists "Allow public insert for research response events" on public.research_response_events;
create policy "Allow public insert for research response events"
on public.research_response_events
for insert
to anon
with check (
  source = 'github-pages'
  and (
    respondent_name is null
    or char_length(trim(respondent_name)) between 2 and 120
  )
  and (
    respondent_email is null
    or char_length(trim(respondent_email)) <= 160
  )
);

grant usage on schema public to anon, authenticated;
grant insert on public.research_response_events to anon;

create view public.research_responses as
with latest_submission as (
  select distinct on (submission_token)
    submission_token,
    created_at as last_saved_at,
    respondent_name,
    respondent_email,
    source
  from public.research_response_events
  order by submission_token, created_at desc, id desc
),
latest_answers as (
  select distinct on (submission_token, question_key)
    submission_token,
    question_key,
    answer
  from public.research_response_events
  where event_type = 'answer'
  order by submission_token, question_key, created_at desc, id desc
),
pivoted as (
  select
    submission_token,
    bool_or(case when question_key = 'q1' then answer end) as q1,
    bool_or(case when question_key = 'q2' then answer end) as q2,
    bool_or(case when question_key = 'q3' then answer end) as q3,
    bool_or(case when question_key = 'q4' then answer end) as q4,
    bool_or(case when question_key = 'q5' then answer end) as q5,
    bool_or(case when question_key = 'q6' then answer end) as q6
  from latest_answers
  group by submission_token
),
submitted as (
  select
    submission_token,
    max(created_at) as submitted_at
  from public.research_response_events
  where event_type = 'submit'
  group by submission_token
)
select
  latest_submission.submission_token as id,
  latest_submission.last_saved_at,
  submitted.submitted_at,
  latest_submission.respondent_name,
  latest_submission.respondent_email,
  pivoted.q1,
  pivoted.q2,
  pivoted.q3,
  pivoted.q4,
  pivoted.q5,
  pivoted.q6,
  coalesce(submitted.submitted_at is not null, false) as completed,
  latest_submission.source
from latest_submission
left join pivoted using (submission_token)
left join submitted using (submission_token)
order by latest_submission.last_saved_at desc;
