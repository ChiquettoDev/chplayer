-- CHPLAYER — migração do banco PostgreSQL; o nome com data define a ordem.
-- Aplicada via Supabase. Não execute novamente em um banco já migrado sem conferir o histórico.
-- A função JavaScript do servidor chama as funções SQL pelo endpoint RPC, usando credencial de serviço.
-- Guarda convite privado, membros, estado do player e mensagens da sala.
create table public.chplayer_rooms (
  code text primary key,
  host text not null,
  movie text not null,
  playback jsonb not null,
  messages jsonb not null default '[]',
  expires timestamptz not null default now() + interval '12 hours'
);
alter table public.chplayer_rooms enable row level security;
revoke all on public.chplayer_rooms from public, anon, authenticated;
grant select, insert, update, delete on public.chplayer_rooms to service_role;

-- Executa comandos de criação, entrada, chat e sincronização de sala.
create function public.chplayer_room(command text, invite text, member text, payload jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  room public.chplayer_rooms%rowtype;
  stamp bigint;
begin
  if not public.chplayer_access('status', member) then return null; end if;
  stamp := floor(extract(epoch from clock_timestamp()) * 1000);
  if command = 'create' then
    delete from public.chplayer_rooms where expires <= now();
    insert into public.chplayer_rooms(code, host, movie, playback)
      values (invite, member, payload->>'movie', jsonb_build_object(
        'seconds', 0, 'playing', false, 'at', stamp));
  end if;
  select * into room from public.chplayer_rooms
    where code = invite and expires > now() for update;
  if not found then return null; end if;
  stamp := floor(extract(epoch from clock_timestamp()) * 1000);
  if command = 'sync' then
    if room.host <> member then return null; end if;
    update public.chplayer_rooms set playback = (payload - 'movie') || jsonb_build_object('at', stamp)
      where code = invite returning * into room;
  elsif command = 'message' then
    update public.chplayer_rooms set messages =
      jsonb_path_query_array(messages, '$[last - 48 to last]') ||
      jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'text', payload->>'text',
        'name', payload->>'name'))
      where code = invite returning * into room;
  end if;
  return jsonb_build_object('movie', room.movie, 'host', room.host = member,
    'playback', room.playback, 'messages', room.messages, 'now', stamp);
end;
$$;
revoke execute on function public.chplayer_room(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.chplayer_room(text,text,text,jsonb) to service_role;
