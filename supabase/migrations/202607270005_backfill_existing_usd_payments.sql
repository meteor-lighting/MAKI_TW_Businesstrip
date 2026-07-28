-- Backfill existing USD expense rows immediately after the recalculation
-- function is deployed. This makes the migration effective without requiring
-- every administrator to change and save a rate once more.
do $$
declare
  report_row record;
begin
  for report_row in
    select
      id,
      nullif(public.jsonb_number(data, 'USD匯率'), 0) as usd_rate
    from public.reports
    where public.jsonb_number(data, 'USD匯率') > 0
  loop
    update public.expense_items
    set data = case
      when category in ('Accommodation', 'Rental Car') then data || jsonb_build_object(
        '匯率', report_row.usd_rate,
        'TWD個人金額', round(public.jsonb_number(data, '個人金額', '金額') * report_row.usd_rate),
        'TWD代墊金額', round(public.jsonb_number(data, '代墊金額', '代墊') * report_row.usd_rate),
        'TWD總體金額', round(public.jsonb_number(data, '總體金額', '總金額') * report_row.usd_rate)
      )
      else data || jsonb_build_object(
        '匯率', report_row.usd_rate,
        'TWD金額', round(public.jsonb_number(data, '金額', '個人金額', '總體金額') * report_row.usd_rate)
      )
    end
    where report_id = report_row.id
      and upper(coalesce(data ->> '幣別', '')) = 'USD';

    perform public.recalculate_report(report_row.id);
  end loop;
end;
$$;
