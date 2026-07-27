\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com',
   '{"employee_code":"H001","display_name":"Owner"}'),
  ('22222222-2222-2222-2222-222222222222', 'viewer@example.com',
   '{"employee_code":"H002","display_name":"Viewer"}');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

do $$
declare
  report_id text;
  stored_total numeric;
  visible_count integer;
begin
  report_id := public.create_report(32.5);
  if report_id <> 'BR-00000001' then
    raise exception 'Unexpected first report ID: %', report_id;
  end if;

  perform public.upsert_expense_item(
    report_id,
    'Gas',
    null,
    '{"日期":"2026-07-01","幣別":"TWD","金額":1250,"TWD金額":1250,"匯率":1}'::jsonb
  );
  select public.jsonb_number(data, '合計TWD總體總額')
    into stored_total from public.reports where id = report_id;
  if stored_total <> 1250 then
    raise exception 'Unexpected total after insert: %', stored_total;
  end if;

  perform public.delete_expense_item(report_id, 'Gas', 1);
  select public.jsonb_number(data, '合計TWD總體總額')
    into stored_total from public.reports where id = report_id;
  if stored_total <> 0 then
    raise exception 'Deleting the final category item left a stale total: %', stored_total;
  end if;

  select count(*) into visible_count from public.reports;
  if visible_count <> 1 then
    raise exception 'Owner should see exactly one report, saw %', visible_count;
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;

do $$
declare visible_count integer;
begin
  select count(*) into visible_count from public.reports;
  if visible_count <> 0 then
    raise exception 'RLS exposed another user''s report';
  end if;
end;
$$;

reset role;
update public.profiles
set can_view_others = true
where id = '22222222-2222-2222-2222-222222222222';

update public.profiles
set must_reset_password = true
where id = '11111111-1111-1111-1111-111111111111';

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;

do $$
declare visible_count integer;
begin
  select count(*) into visible_count from public.reports;
  if visible_count <> 0 then
    raise exception 'Password-reset session could read report data';
  end if;

  begin
    perform public.create_report(32.5);
    raise exception 'Password-reset session could create a report';
  exception
    when others then
      if sqlerrm = 'Password-reset session could create a report' then raise; end if;
      if sqlerrm <> 'Password reset required' then raise; end if;
  end;
end;
$$;

reset role;
update auth.users
set encrypted_password = 'new-password-hash'
where id = '11111111-1111-1111-1111-111111111111';

do $$
declare reset_still_required boolean;
begin
  select must_reset_password into reset_still_required
  from public.profiles
  where id = '11111111-1111-1111-1111-111111111111';
  if reset_still_required then
    raise exception 'Password update did not clear the required-reset flag';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;

do $$
declare visible_count integer;
begin
  select count(*) into visible_count from public.reports;
  if visible_count <> 1 then
    raise exception 'View-others permission did not expose the report';
  end if;
end;
$$;

reset role;
select 'migration verification passed' as result;
