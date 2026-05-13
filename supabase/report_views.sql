drop view if exists public.research_report_answer_distribution;
drop view if exists public.research_report_dimension_scores;
drop view if exists public.research_report_totals;

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
