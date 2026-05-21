alter table public.conversations
  add column if not exists expires_at timestamptz
  not null
  default (now() + interval '7 days');

update public.conversations
set expires_at = updated_at + interval '7 days'
where expires_at < updated_at;

create index if not exists conversations_expires_at_idx
  on public.conversations (expires_at);

create or replace function public.cleanup_expired_chat_data()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  expired_storage_paths text[];
begin
  select coalesce(array_agg(a.storage_path), array[]::text[])
  into expired_storage_paths
  from public.attachments a
  join public.messages m on m.id = a.message_id
  join public.conversations c on c.id = m.conversation_id
  where c.expires_at <= now();

  if array_length(expired_storage_paths, 1) is not null then
    delete from storage.objects
    where bucket_id = 'message-attachments'
      and name = any(expired_storage_paths);
  end if;

  delete from public.conversations
  where expires_at <= now();

  delete from public.users u
  where not exists (
    select 1
    from public.conversations c
    where c.user_id = u.id
  )
    and coalesce(u.last_seen_at, u.created_at) <= now() - interval '7 days';
end;
$$;

create extension if not exists pg_cron with schema extensions;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'cleanup-expired-chat-data'
  ) then
    perform cron.schedule(
      'cleanup-expired-chat-data',
      '15 * * * *',
      'select public.cleanup_expired_chat_data();'
    );
  end if;
end;
$$;
