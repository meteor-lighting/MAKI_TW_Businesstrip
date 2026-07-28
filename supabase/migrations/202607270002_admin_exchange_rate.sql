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

  perform public.recalculate_report(target_report_id);
end;
$$;

revoke execute on function public.update_report_exchange_rate(text, numeric) from public;
grant execute on function public.update_report_exchange_rate(text, numeric) to authenticated;
