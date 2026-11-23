-- CHPLAYER — migração do banco PostgreSQL; o nome com data define a ordem.
-- Aplicada via Supabase. Não execute novamente em um banco já migrado sem conferir o histórico.
-- A função JavaScript do servidor chama as funções SQL pelo endpoint RPC, usando credencial de serviço.
begin;

-- Guarda pedido, hashes de acesso e limites de uso; não guarda a chave legível.
create table public.chplayer_orders (
  id text primary key,
  link_hash text unique,
  license_hash text unique,
  installation_hash text unique,
  downloads integer not null default 0 check (downloads between 0 and 2),
  revoked boolean not null default false,
  pending_email text,
  pending_link text,
  pending_key text,
  mail_id uuid not null default gen_random_uuid()
);

alter table public.chplayer_orders enable row level security;
revoke all on table public.chplayer_orders from public, anon, authenticated;
grant select, insert, update on table public.chplayer_orders to service_role;

-- Registra/libera uma compra aprovada; é chamada pelo webhook do servidor.
create function public.chplayer_purchase(
  order_id text, buyer_email text, link_token text, license_key text,
  link_digest text, license_digest text
) returns jsonb
language plpgsql set search_path = '' as $$
declare delivery jsonb;
begin
  insert into public.chplayer_orders(id, link_hash, license_hash, pending_email, pending_link, pending_key)
    values (order_id, link_digest, license_digest, buyer_email, link_token, license_key)
    on conflict (id) do nothing;
  select jsonb_build_object('email', pending_email, 'link', pending_link, 'key', pending_key, 'id', mail_id)
    into delivery from public.chplayer_orders
    where id = order_id and not revoked and pending_email is not null;
  return delivery;
end;
$$;

-- Revoga o pedido em cancelamento, reembolso ou contestação.
create function public.chplayer_revoke(order_id text) returns void
language sql set search_path = '' as $$
  insert into public.chplayer_orders(id, revoked) values (order_id, true)
  on conflict (id) do update set revoked = true, installation_hash = null,
    pending_email = null, pending_link = null, pending_key = null;
$$;

-- Autoriza ativação/status/download e aplica as regras de acesso.
create function public.chplayer_access(action text, digest text, device text default null) returns boolean
language plpgsql set search_path = '' as $$
begin
  if action = 'download' then
    update public.chplayer_orders set downloads = downloads + 1
      where link_hash = digest and not revoked and downloads < 2;
    return found;
  elsif action = 'available' then
    return exists (select 1 from public.chplayer_orders
      where link_hash = digest and not revoked and downloads < 2);
  elsif action = 'status' then
    return exists (select 1 from public.chplayer_orders
      where installation_hash = digest and not revoked);
  elsif action = 'activate' and device is not null then
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

revoke all on function public.chplayer_purchase(text,text,text,text,text,text),
  public.chplayer_revoke(text), public.chplayer_access(text,text,text)
  from public, anon, authenticated;
grant execute on function public.chplayer_purchase(text,text,text,text,text,text),
  public.chplayer_revoke(text), public.chplayer_access(text,text,text) to service_role;

insert into storage.buckets(id, name, public, file_size_limit)
  values ('chplayer-apk', 'chplayer-apk', false, 50000000)
  on conflict (id) do nothing;

commit;
