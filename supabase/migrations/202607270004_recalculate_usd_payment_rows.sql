-- Recalculate stored TWD amounts for USD expense rows when an administrator
-- changes the report-level USD rate.
create or replace function public.update_report_exchange_rate(
  target_report_id text,
  new_usd_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator permission required';
  end if;

  if new_usd_rate is null or new_usd_rate <= 0 then
    raise exception 'Exchange rate must be greater than zero';
  end if;

  update public.reports
  set data = data || jsonb_build_object('USD匯率', new_usd_rate)
  where id = target_report_id;

  if not found then
    raise exception 'Report not found';
  end if;

  update public.expense_items
  set data = case
    when category in ('Accommodation', 'Rental Car') then data || jsonb_build_object(
      '匯率', new_usd_rate,
      'TWD個人金額', round(public.jsonb_number(data, '個人金額', '金額') * new_usd_rate),
      'TWD代墊金額', round(public.jsonb_number(data, '代墊金額', '代墊') * new_usd_rate),
      'TWD總體金額', round(public.jsonb_number(data, '總體金額', '總金額') * new_usd_rate)
    )
    else data || jsonb_build_object(
      '匯率', new_usd_rate,
      'TWD金額', round(public.jsonb_number(data, '金額', '個人金額', '總體金額') * new_usd_rate)
    )
  end
  where report_id = target_report_id
    and upper(coalesce(data ->> '幣別', '')) = 'USD';

  perform public.recalculate_report(target_report_id);
end;
$$;

revoke execute on function public.update_report_exchange_rate(text, numeric) from public;
grant execute on function public.update_report_exchange_rate(text, numeric) to authenticated;
