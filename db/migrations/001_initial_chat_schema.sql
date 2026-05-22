create table if not exists users (
  id text primary key,
  username text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists conversations (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  constraint conversations_status_check check (status in ('open', 'archived'))
);

create table if not exists messages (
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin', 'assistant')),
  text text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists attachments (
  id text primary key,
  message_id text not null references messages(id) on delete cascade,
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
  on conversations (user_id, updated_at desc);

create index if not exists conversations_expires_at_idx
  on conversations (expires_at);

create index if not exists messages_conversation_created_idx
  on messages (conversation_id, created_at asc);

create index if not exists attachments_message_idx
  on attachments (message_id);
