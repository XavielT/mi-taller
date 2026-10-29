-- Mi Taller · 2026-10-29 · 006 · primer administrador de la plataforma
-- El usuario ya existe en auth.users (cuenta compartida de x-core): solo se le otorga el permiso.
insert into mitaller.admins_plataforma (user_id, nota)
select id, 'Propietario de la plataforma'
from auth.users
where lower(email) = 'xavieldev@gmail.com'
on conflict (user_id) do nothing;
