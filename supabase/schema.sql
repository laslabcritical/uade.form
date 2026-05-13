create extension if not exists pgcrypto;

drop view if exists public.research_report_answer_distribution;
drop view if exists public.research_report_dimension_scores;
drop view if exists public.research_report_totals;
drop view if exists public.research_responses;
drop table if exists public.research_response_events cascade;
drop table if exists public.research_responses cascade;

create table public.research_response_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submission_token uuid not null,
  event_type text not null check (event_type in ('answer', 'submit')),
  question_key text check (
    question_key is null
    or question_key in (
      'a1', 'a2', 'a3', 'a4', 'a5', 'a6',
      'b1', 'b2', 'b3', 'b4', 'b5', 'b6',
      'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
      'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7',
      'e1', 'e2', 'e3', 'e4', 'e5',
      'cierre1', 'cierre2', 'cierre3', 'cierre4', 'cierre5'
    )
  ),
  answer_value text,
  answers jsonb,
  source text not null default 'github-pages',
  is_complete boolean not null default false,
  constraint response_event_shape check (
    (
      event_type = 'answer'
      and question_key is not null
      and answer_value is not null
      and answers is null
      and is_complete = false
    )
    or (
      event_type = 'submit'
      and question_key is null
      and answer_value is null
      and answers is not null
      and is_complete = true
    )
  ),
  constraint answer_value_length check (
    answer_value is null
    or char_length(trim(answer_value)) between 1 and 240
  ),
  constraint answers_shape check (
    answers is null
    or jsonb_typeof(answers) = 'object'
  )
);

create index research_response_events_submission_idx
on public.research_response_events (submission_token, created_at desc);

create index research_response_events_event_idx
on public.research_response_events (event_type, created_at desc);

create index research_response_events_question_idx
on public.research_response_events (question_key, created_at desc);

alter table public.research_response_events enable row level security;

drop policy if exists "Allow public insert for research response events" on public.research_response_events;
create policy "Allow public insert for research response events"
on public.research_response_events
for insert
to anon
with check (
  source = 'github-pages'
  and event_type in ('answer', 'submit')
  and (
    answer_value is null
    or char_length(trim(answer_value)) between 1 and 240
  )
  and (
    answers is null
    or jsonb_typeof(answers) = 'object'
  )
);

grant usage on schema public to anon, authenticated;
grant insert on public.research_response_events to anon;

create view public.research_responses as
with latest_event as (
  select distinct on (submission_token)
    submission_token,
    created_at as last_saved_at,
    source
  from public.research_response_events
  order by submission_token, created_at desc, id desc
),
latest_answer_events as (
  select distinct on (submission_token, question_key)
    submission_token,
    question_key,
    answer_value
  from public.research_response_events
  where event_type = 'answer'
  order by submission_token, question_key, created_at desc, id desc
),
pivoted_answer_events as (
  select
    submission_token,
    max(answer_value) filter (where question_key = 'a1') as a1,
    max(answer_value) filter (where question_key = 'a2') as a2,
    max(answer_value) filter (where question_key = 'a3') as a3,
    max(answer_value) filter (where question_key = 'a4') as a4,
    max(answer_value) filter (where question_key = 'a5') as a5,
    max(answer_value) filter (where question_key = 'a6') as a6,
    max(answer_value) filter (where question_key = 'b1') as b1,
    max(answer_value) filter (where question_key = 'b2') as b2,
    max(answer_value) filter (where question_key = 'b3') as b3,
    max(answer_value) filter (where question_key = 'b4') as b4,
    max(answer_value) filter (where question_key = 'b5') as b5,
    max(answer_value) filter (where question_key = 'b6') as b6,
    max(answer_value) filter (where question_key = 'c1') as c1,
    max(answer_value) filter (where question_key = 'c2') as c2,
    max(answer_value) filter (where question_key = 'c3') as c3,
    max(answer_value) filter (where question_key = 'c4') as c4,
    max(answer_value) filter (where question_key = 'c5') as c5,
    max(answer_value) filter (where question_key = 'c6') as c6,
    max(answer_value) filter (where question_key = 'd1') as d1,
    max(answer_value) filter (where question_key = 'd2') as d2,
    max(answer_value) filter (where question_key = 'd3') as d3,
    max(answer_value) filter (where question_key = 'd4') as d4,
    max(answer_value) filter (where question_key = 'd5') as d5,
    max(answer_value) filter (where question_key = 'd6') as d6,
    max(answer_value) filter (where question_key = 'd7') as d7,
    max(answer_value) filter (where question_key = 'e1') as e1,
    max(answer_value) filter (where question_key = 'e2') as e2,
    max(answer_value) filter (where question_key = 'e3') as e3,
    max(answer_value) filter (where question_key = 'e4') as e4,
    max(answer_value) filter (where question_key = 'e5') as e5,
    max(answer_value) filter (where question_key = 'cierre1') as cierre1,
    max(answer_value) filter (where question_key = 'cierre2') as cierre2,
    max(answer_value) filter (where question_key = 'cierre3') as cierre3,
    max(answer_value) filter (where question_key = 'cierre4') as cierre4,
    max(answer_value) filter (where question_key = 'cierre5') as cierre5
  from latest_answer_events
  group by submission_token
),
latest_submit as (
  select distinct on (submission_token)
    submission_token,
    created_at as submitted_at,
    answers
  from public.research_response_events
  where event_type = 'submit'
  order by submission_token, created_at desc, id desc
)
select
  latest_event.submission_token as id,
  latest_event.last_saved_at,
  latest_submit.submitted_at,
  coalesce(latest_submit.answers ->> 'a1', pivoted_answer_events.a1) as a1,
  coalesce(latest_submit.answers ->> 'a2', pivoted_answer_events.a2) as a2,
  coalesce(latest_submit.answers ->> 'a3', pivoted_answer_events.a3) as a3,
  coalesce(latest_submit.answers ->> 'a4', pivoted_answer_events.a4) as a4,
  coalesce(latest_submit.answers ->> 'a5', pivoted_answer_events.a5) as a5,
  coalesce(latest_submit.answers ->> 'a6', pivoted_answer_events.a6) as a6,
  coalesce(latest_submit.answers ->> 'b1', pivoted_answer_events.b1) as b1,
  coalesce(latest_submit.answers ->> 'b2', pivoted_answer_events.b2) as b2,
  coalesce(latest_submit.answers ->> 'b3', pivoted_answer_events.b3) as b3,
  coalesce(latest_submit.answers ->> 'b4', pivoted_answer_events.b4) as b4,
  coalesce(latest_submit.answers ->> 'b5', pivoted_answer_events.b5) as b5,
  coalesce(latest_submit.answers ->> 'b6', pivoted_answer_events.b6) as b6,
  coalesce(latest_submit.answers ->> 'c1', pivoted_answer_events.c1) as c1,
  coalesce(latest_submit.answers ->> 'c2', pivoted_answer_events.c2) as c2,
  coalesce(latest_submit.answers ->> 'c3', pivoted_answer_events.c3) as c3,
  coalesce(latest_submit.answers ->> 'c4', pivoted_answer_events.c4) as c4,
  coalesce(latest_submit.answers ->> 'c5', pivoted_answer_events.c5) as c5,
  coalesce(latest_submit.answers ->> 'c6', pivoted_answer_events.c6) as c6,
  coalesce(latest_submit.answers ->> 'd1', pivoted_answer_events.d1) as d1,
  coalesce(latest_submit.answers ->> 'd2', pivoted_answer_events.d2) as d2,
  coalesce(latest_submit.answers ->> 'd3', pivoted_answer_events.d3) as d3,
  coalesce(latest_submit.answers ->> 'd4', pivoted_answer_events.d4) as d4,
  coalesce(latest_submit.answers ->> 'd5', pivoted_answer_events.d5) as d5,
  coalesce(latest_submit.answers ->> 'd6', pivoted_answer_events.d6) as d6,
  coalesce(latest_submit.answers ->> 'd7', pivoted_answer_events.d7) as d7,
  coalesce(latest_submit.answers ->> 'e1', pivoted_answer_events.e1) as e1,
  coalesce(latest_submit.answers ->> 'e2', pivoted_answer_events.e2) as e2,
  coalesce(latest_submit.answers ->> 'e3', pivoted_answer_events.e3) as e3,
  coalesce(latest_submit.answers ->> 'e4', pivoted_answer_events.e4) as e4,
  coalesce(latest_submit.answers ->> 'e5', pivoted_answer_events.e5) as e5,
  coalesce(latest_submit.answers ->> 'cierre1', pivoted_answer_events.cierre1) as cierre1,
  coalesce(latest_submit.answers ->> 'cierre2', pivoted_answer_events.cierre2) as cierre2,
  coalesce(latest_submit.answers ->> 'cierre3', pivoted_answer_events.cierre3) as cierre3,
  coalesce(latest_submit.answers ->> 'cierre4', pivoted_answer_events.cierre4) as cierre4,
  coalesce(latest_submit.answers ->> 'cierre5', pivoted_answer_events.cierre5) as cierre5,
  coalesce(latest_submit.submitted_at is not null, false) as completed,
  latest_event.source
from latest_event
left join pivoted_answer_events using (submission_token)
left join latest_submit using (submission_token)
order by latest_event.last_saved_at desc;

create view public.research_report_totals as
select
  count(distinct submission_token)::integer as started_responses,
  count(distinct submission_token) filter (where event_type = 'answer')::integer as answered_responses,
  count(distinct submission_token) filter (where event_type = 'submit')::integer as completed_responses,
  (
    count(distinct submission_token)
    - count(distinct submission_token) filter (where event_type = 'submit')
  )::integer as in_progress_responses,
  coalesce(
    round(
      (
        count(distinct submission_token) filter (where event_type = 'submit')
      )::numeric
      / nullif(count(distinct submission_token), 0)
      * 100,
      1
    ),
    0
  ) as completion_rate
from public.research_response_events;

create view public.research_report_answer_distribution as
with normalized_answers as (
  select
    answers.question_key,
    answers.answer_value
  from public.research_responses
  cross join lateral (
    values
      ('a1', a1), ('a2', a2), ('a3', a3), ('a4', a4), ('a5', a5), ('a6', a6),
      ('b1', b1), ('b2', b2), ('b3', b3), ('b4', b4), ('b5', b5), ('b6', b6),
      ('c1', c1), ('c2', c2), ('c3', c3), ('c4', c4), ('c5', c5), ('c6', c6),
      ('d1', d1), ('d2', d2), ('d3', d3), ('d4', d4), ('d5', d5), ('d6', d6), ('d7', d7),
      ('e1', e1), ('e2', e2), ('e3', e3), ('e4', e4), ('e5', e5),
      ('cierre1', cierre1), ('cierre2', cierre2), ('cierre3', cierre3), ('cierre4', cierre4), ('cierre5', cierre5)
  ) as answers(question_key, answer_value)
  where answers.answer_value is not null
)
select
  question_key,
  answer_value,
  count(*)::integer as response_count
from normalized_answers
group by question_key, answer_value
order by question_key, answer_value;

create view public.research_report_dimension_scores as
with normalized_likert_answers as (
  select
    answers.dimension_key,
    answers.answer_value
  from public.research_responses
  cross join lateral (
    values
      ('a', a1), ('a', a2), ('a', a3), ('a', a4), ('a', a5), ('a', a6),
      ('b', b1), ('b', b2), ('b', b3), ('b', b4), ('b', b5), ('b', b6),
      ('c', c1), ('c', c2), ('c', c3), ('c', c4), ('c', c5), ('c', c6),
      ('d', d1), ('d', d2), ('d', d3), ('d', d4), ('d', d5), ('d', d6), ('d', d7),
      ('e', e1), ('e', e2), ('e', e3), ('e', e4), ('e', e5)
  ) as answers(dimension_key, answer_value)
  where answers.answer_value is not null
),
scored_answers as (
  select
    dimension_key,
    case answer_value
      when 'totalmente_en_desacuerdo' then 1
      when 'en_desacuerdo' then 2
      when 'ni_de_acuerdo_ni_en_desacuerdo' then 3
      when 'de_acuerdo' then 4
      when 'totalmente_de_acuerdo' then 5
      else null
    end as score
  from normalized_likert_answers
)
select
  dimension_key,
  count(score)::integer as answered_count,
  round(avg(score), 2) as average_score,
  coalesce(
    round(count(*) filter (where score >= 4)::numeric / nullif(count(score), 0) * 100, 1),
    0
  ) as agreement_rate,
  coalesce(
    round(count(*) filter (where score <= 2)::numeric / nullif(count(score), 0) * 100, 1),
    0
  ) as disagreement_rate
from scored_answers
where score is not null
group by dimension_key
order by dimension_key;

grant select on public.research_report_totals to anon, authenticated;
grant select on public.research_report_answer_distribution to anon, authenticated;
grant select on public.research_report_dimension_scores to anon, authenticated;
