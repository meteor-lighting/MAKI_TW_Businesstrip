-- Allow every authenticated report editor to update report-level exchange rates.
-- Report ownership and lock checks remain enforced by can_edit_report().
create or replace function public.update_report_exchange_rate(
  target_report_id text,
  target_currency text,
  new_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  currency_code text := upper(trim(target_currency));
begin
  if not public.can_edit_report(target_report_id) then
    raise exception 'Report is locked or you cannot edit it';
  end if;

  if currency_code !~ '^[A-Z]{3}$' or currency_code = 'TWD' then
    raise exception 'Only non-TWD currency rates can be edited';
  end if;

  if new_rate is null or new_rate <= 0 then
    raise exception 'Exchange rate must be greater than zero';
  end if;

  update public.reports
  set data = data || jsonb_build_object(currency_code || '匯率', new_rate)
  where id = target_report_id;

  if not found then
    raise exception 'Report not found';
  end if;

  update public.expense_items
  set data = case
    when category in ('Accommodation', 'Rental Car') then data || jsonb_build_object(
      '匯率', new_rate,
      'TWD個人金額', round(public.jsonb_number(data, '個人金額', '金額') * new_rate),
      'TWD代墊金額', round(public.jsonb_number(data, '代墊金額', '代墊') * new_rate),
      'TWD總體金額', round(public.jsonb_number(data, '總體金額', '總金額') * new_rate)
    )
    else data || jsonb_build_object(
      '匯率', new_rate,
      'TWD金額', round(public.jsonb_number(data, '金額', '個人金額', '總體金額') * new_rate)
    )
  end
  where report_id = target_report_id
    and upper(coalesce(data ->> '幣別', '')) = currency_code;

  perform public.recalculate_report(target_report_id);
end;
$$;

revoke execute on function public.update_report_exchange_rate(text, text, numeric) from public;
grant execute on function public.update_report_exchange_rate(text, text, numeric) to authenticated;
