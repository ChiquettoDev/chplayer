-- CHPLAYER — migração do banco PostgreSQL; o nome com data define a ordem.
-- Aplicada via Supabase. Não execute novamente em um banco já migrado sem conferir o histórico.
-- A função JavaScript do servidor chama as funções SQL pelo endpoint RPC, usando credencial de serviço.
begin;

-- Guarda hashes das chaves de teste do proprietário.
create table public.chplayer_owner_keys (
  id text primary key,
  license_hash text not null unique,
  revoked boolean not null default false
);
-- Relaciona a chave do proprietário às instalações de teste.
create table public.chplayer_owner_devices (
  installation_hash text primary key,
  owner_id text not null references public.chplayer_owner_keys(id),
  activated_at timestamptz not null default now()
);
alter table public.chplayer_owner_keys enable row level security;
alter table public.chplayer_owner_devices enable row level security;
revoke all on public.chplayer_owner_keys, public.chplayer_owner_devices from public, anon, authenticated;
grant select, insert, update on public.chplayer_owner_keys, public.chplayer_owner_devices to service_role;

-- Autoriza ativação/status/download e aplica as regras de acesso.
create or replace function public.chplayer_access(action text, digest text, device text default null)
returns boolean language plpgsql set search_path = '' as $$
declare owner_key text;
begin
  if action = 'download' then
    update public.chplayer_orders set downloads = downloads + 1
      where link_hash = digest and not revoked and downloads < 2;
    return found;
  elsif action = 'available' then
    return exists (select 1 from public.chplayer_orders
      where link_hash = digest and not revoked and downloads < 2);
  elsif action = 'status' then
    return exists (select 1 from public.chplayer_orders where installation_hash = digest and not revoked)
      or exists (
        select 1 from public.chplayer_owner_devices d
        join public.chplayer_owner_keys k on k.id = d.owner_id
        where d.installation_hash = digest and not k.revoked
      );
  elsif action = 'activate' and device is not null then
    select id into owner_key from public.chplayer_owner_keys
      where license_hash = digest and not revoked for share;
    if found then
      insert into public.chplayer_owner_devices(installation_hash, owner_id)
        values (device, owner_key)
        on conflict (installation_hash) do update set owner_id = excluded.owner_id;
      return true;
    end if;
    update public.chplayer_orders set installation_hash = device
      where license_hash = digest and not revoked
      and (installation_hash is null or installation_hash = device);
    return found;
  end if;
  return false;
exception when unique_violation then
  return false;
end;
$$;
revoke all on function public.chplayer_access(text,text,text) from public, anon, authenticated;
grant execute on function public.chplayer_access(text,text,text) to service_role;
commit;
