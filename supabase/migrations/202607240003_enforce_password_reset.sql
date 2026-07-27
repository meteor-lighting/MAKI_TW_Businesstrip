-- A recovery link creates an authenticated session before the user chooses a
-- new password. Keep that temporary session away from report data until the
-- password-change trigger clears profiles.must_reset_password.

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select role = 'admin' and not must_reset_password
    from public.profiles
    where id = auth.uid()
  ), false)
$$;

create or replace function public.can_view_others()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select can_view_others and not must_reset_password
    from public.profiles
    where id = auth.uid()
  ), false)
$$;

create or replace function public.can_view_report(target_report_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.reports r
    join public.profiles p on p.id = auth.uid()
    where r.id = target_report_id
      and not p.must_reset_password
      and (r.owner_id = auth.uid() or p.role = 'admin' or p.can_view_others)
  )
$$;

create or replace function public.can_edit_report(target_report_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.reports r
    join public.profiles p on p.id = auth.uid()
    where r.id = target_report_id
      and r.status = ''
      and not p.must_reset_password
      and (r.owner_id = auth.uid() or p.role = 'admin')
  )
$$;

create or replace function public.block_pending_password_reset_report_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and exists (
    select 1
    from public.profiles
    where id = auth.uid() and must_reset_password
  ) then
    raise exception 'Password reset required';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_require_completed_password_reset on public.reports;
create trigger reports_require_completed_password_reset
before insert or update or delete on public.reports
for each row execute function public.block_pending_password_reset_report_changes();

drop trigger if exists expenses_require_completed_password_reset on public.expense_items;
create trigger expenses_require_completed_password_reset
before insert or update or delete on public.expense_items
for each row execute function public.block_pending_password_reset_report_changes();

revoke execute on function public.block_pending_password_reset_report_changes() from public;

-- Password changes now clear the flag atomically through
-- handle_auth_password_change(), so this client-callable bypass is obsolete.
drop function if exists public.complete_password_reset();
