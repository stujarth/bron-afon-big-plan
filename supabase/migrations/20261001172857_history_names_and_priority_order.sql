create or replace function public.project_history_named(p_project uuid)
returns table(id bigint, changed_at timestamptz, changed_by uuid, changed_by_name text, action text, changes jsonb)
language sql stable security definer set search_path = public as $$
  select h.id, h.changed_at, h.changed_by,
         case when h.changed_by is null then 'Imported' else coalesce(p.full_name, p.email, 'Former user') end,
         h.action, h.changes
  from public.project_history h left join public.profiles p on p.id = h.changed_by
  where h.project_id = p_project and auth.uid() is not null
  order by h.changed_at desc limit 40;
$$;
revoke execute on function public.project_history_named(uuid) from public, anon;
grant execute on function public.project_history_named(uuid) to authenticated;

create or replace function public.set_priority_order(p_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.can_decide() then raise exception 'Only ELT can record or change a prioritisation decision.'; end if;
  update public.projects p set priority = o.ord
    from unnest(p_ids) with ordinality as o(id, ord)
    where p.id = o.id and p.priority is distinct from o.ord::int;
end $$;
revoke execute on function public.set_priority_order(uuid[]) from public, anon;
grant execute on function public.set_priority_order(uuid[]) to authenticated;
