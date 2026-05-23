create table if not exists ai_daily_token_usage (
  usage_day date primary key,
  prompt_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  request_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists ai_token_usage_reservations (
  id text primary key,
  usage_day date not null,
  reserved_tokens bigint not null,
  actual_total_tokens bigint,
  status text not null check (status in ('active', 'completed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_token_usage_reservations_usage_day_idx
on ai_token_usage_reservations (usage_day, status);
