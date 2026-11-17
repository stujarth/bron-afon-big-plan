create or replace function public.mark_password_changed()
returns void language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

create or replace function public.mark_onboarded()
returns void language sql security definer set search_path = public as $$
  update public.profiles set onboarded_at = now() where id = auth.uid();
$$;

-- Server-side only: create a confirmed email/password user.
create or replace function public.pilot_create_user(p_email text, p_password text, p_role text, p_name text)
returns uuid language plpgsql security definer set search_path = public, auth, extensions as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, is_sso_user)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', lower(p_email),
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', p_name), now(), now(),
    '', '', '', '', '', false);
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, 'email',
    jsonb_build_object('sub', uid::text, 'email', lower(p_email), 'email_verified', true, 'phone_verified', false), now(), now(), now());
  update public.profiles set role = p_role, full_name = p_name, must_change_password = true where id = uid;
  return uid;
end $$;

create or replace function public.temp_password()
returns text language sql volatile set search_path = public as $$
  select (array['Afon','Cwmbran','Torfaen','Blaenavon','Pontypool','Garn','Llantarnam','Croesyceiliog'])[1 + floor(random()*8)::int]
      || '-' || (array['Oak','Elm','Ash','Birch','Rowan','Hazel','Alder','Willow'])[1 + floor(random()*8)::int]
      || '-' || (1000 + floor(random()*9000)::int)::text;
$$;

create or replace function public.admin_create_user(p_email text, p_name text, p_role text)
returns text language plpgsql security definer set search_path = public, auth, extensions as $$
declare temp text := public.temp_password();
begin
  if public.current_role() <> 'admin' then raise exception 'Only an admin can add people.'; end if;
  if p_role not in ('viewer','editor','elt','admin') then raise exception 'Unknown role.'; end if;
  if lower(split_part(p_email, '@', 2)) <> 'bronafon.org.uk' then raise exception 'Only Bron Afon (@bronafon.org.uk) email addresses can be added.'; end if;
  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then raise exception 'That person already has an account.'; end if;
  perform public.pilot_create_user(p_email, temp, p_role, p_name);
  return temp;
end $$;

create or replace function public.admin_set_role(p_email text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'admin' then raise exception 'Only an admin can change roles.'; end if;
  if p_role not in ('viewer','editor','elt','admin') then raise exception 'Unknown role.'; end if;
  update public.profiles set role = p_role where lower(email) = lower(p_email);
end $$;

create or replace function public.admin_reset_password(p_email text)
returns text language plpgsql security definer set search_path = public, auth, extensions as $$
declare temp text := public.temp_password();
begin
  if public.current_role() <> 'admin' then raise exception 'Only an admin can reset a password.'; end if;
  update auth.users set encrypted_password = extensions.crypt(temp, extensions.gen_salt('bf')), updated_at = now() where lower(email) = lower(p_email);
  if not found then raise exception 'No account with that email.'; end if;
  update public.profiles set must_change_password = true where lower(email) = lower(p_email);
  return temp;
end $$;

-- lock down
revoke execute on function public.enforce_allowed_email_domain() from public, anon, authenticated;
revoke execute on function public.create_profile_for_user()      from public, anon, authenticated;
revoke execute on function public.projects_before_write()        from public, anon, authenticated;
revoke execute on function public.projects_assign_ref()          from public, anon, authenticated;
revoke execute on function public.projects_audit()               from public, anon, authenticated;
revoke execute on function public.project_teams_audit()          from public, anon, authenticated;
revoke execute on function public.pilot_create_user(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.temp_password()                from public, anon, authenticated;
revoke execute on function public.current_role() from public, anon;
revoke execute on function public.can_edit()     from public, anon;
revoke execute on function public.can_decide()   from public, anon;
revoke execute on function public.mark_password_changed() from public, anon;
revoke execute on function public.mark_onboarded()        from public, anon;
revoke execute on function public.admin_create_user(text, text, text) from public, anon;
revoke execute on function public.admin_set_role(text, text)          from public, anon;
revoke execute on function public.admin_reset_password(text)          from public, anon;
grant execute on function public.mark_password_changed(), public.mark_onboarded(),
  public.admin_create_user(text, text, text), public.admin_set_role(text, text), public.admin_reset_password(text) to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;
