-- Mi Taller · 2026-10-29 · 004 · proyecto x-core (compartido) · aplicada el 2026-10-29
-- OJO: modifica public.enforce_invite_only, que es de Music Hub. Solo agrega 'mitaller' a la lista de apps
-- de registro abierto (igual que 'carguy'); el resto de la funcion queda identico al original del 2026-09-18.
-- El registro abierto no otorga nada: el acceso a cada app lo controlan sus propias politicas RLS.
-- Si Mi Taller se mueve a su propio proyecto Supabase, esta migracion no se necesita.

CREATE OR REPLACE FUNCTION public.enforce_invite_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_token text;
begin
  -- ===== Car Guy, Mi Taller, and any future app that sets raw_user_meta_data.app =====
  -- Car Guy is a consumer app with open signup; Music Hub is invite-only. The
  -- flag only opens signup — it grants nothing — so a user-controlled field is
  -- the right place for it.
  if coalesce(new.raw_user_meta_data ->> 'app', '') in ('carguy', 'mitaller') then
    return new;
  end if;
  -- ===== everything below is unchanged from 2026-09-18 =====

  if exists (
    select 1 from public.allowed_emails
    where email = lower(trim(new.email))
  ) then
    return new;
  end if;

  v_token := nullif(trim(new.raw_user_meta_data ->> 'invite_token'), '');
  if v_token is not null then
    -- Claimed and spent in one statement, so two people racing the same link
    -- cannot both win it. This runs inside the insert's transaction: if the
    -- sign-up fails afterwards, the link is unspent again.
    update public.invite_links
       set used_at = now(), used_by = new.id
     where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
       and used_at is null
       and revoked_at is null
       and expires_at > now();
    if found then
      return new;
    end if;
  end if;

  raise exception 'Sign-ups are invite-only. Ask Xaviel for an invite link.'
    using errcode = 'P0001';
end;
$function$;
