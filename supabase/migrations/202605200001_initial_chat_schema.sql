create table if not exists public.users (
  id text primary key,
  username text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.conversations (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_status_check check (status in ('open', 'archived'))
);

create table if not exists public.messages (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin', 'assistant')),
  text text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id text primary key,
  message_id text not null references public.messages(id) on delete cascade,
  kind text not null check (kind in ('image', 'audio', 'video')),
  storage_path text not null,
  url text not null,
  mime_type text not null,
  size integer not null,
  duration_ms integer,
  width integer,
  height integer,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

create index if not exists attachments_message_idx
  on public.attachments (message_id);

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;
