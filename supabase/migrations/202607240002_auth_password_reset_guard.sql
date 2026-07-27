-- Keep the application-level reset requirement synchronized with Supabase
-- Auth. Updating a password and clearing the profile flag now happen in the
-- same database transaction, preventing a reset loop if the client disconnects
-- between those two operations.
create or replace function public.handle_auth_password_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.encrypted_password is distinct from new.encrypted_password then
    update public.profiles
    set must_reset_password = false
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_password_changed on auth.users;
create trigger on_auth_user_password_changed
after update of encrypted_password on auth.users
for each row execute function public.handle_auth_password_change();

revoke execute on function public.handle_auth_password_change() from public;
