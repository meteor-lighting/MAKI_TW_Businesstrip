-- Keep the report-level USD rate authoritative when recalculating totals.
-- Expense-item USD rates are historical currency-to-TWD rates and must not
-- overwrite the report's configured TWD-per-USD rate.
create or replace function public.recalculate_report(target_report_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  totals jsonb := jsonb_build_object(
    '機票費總額', 0, '機票費USD總額', 0,
    '個人住宿費總額', 0, '個人住宿費USD總額', 0,
    '總體住宿費總額', 0, '總體住宿費USD總額', 0,
    '個人租車費總額', 0, '個人租車費USD總額', 0,
    '總體租車費總額', 0, '總體租車費USD總額', 0,
    '交通運輸費總額', 0, '交通運輸費USD總額', 0,
    '瓦斯費總額', 0, '瓦斯費USD總額', 0,
    '停車費總額', 0, '停車費USD總額', 0,
    '網路費總額', 0, '網路費USD總額', 0,
    '社交費總額', 0, '社交費USD總額', 0,
    '禮品費總額', 0, '禮品費USD總額', 0,
    '行李費總額', 0, '行李費USD總額', 0,
    '手續費總額', 0, '手續費USD總額', 0,
    '日支費總額', 0, '日支費USD總額', 0,
    '預支費用總額', 0, '預支費用USD總額', 0,
    '午餐與學費總額', 0, '午餐與學費USD總額', 0,
    '其他費用總額', 0, '其他費用USD總額', 0
  );
  row record;
  amount numeric;
  personal numeric;
  grand numeric := 0;
  personal_grand numeric := 0;
  advance_total numeric := 0;
  days_count numeric;
  usd_rate numeric;
  header jsonb;
  twd_key text;
  usd_key text;
begin
  select
    data,
    greatest(days, 0),
    coalesce(
      nullif(public.jsonb_number(data, 'USD匯率'), 0),
      nullif((
        select max(public.jsonb_number(i.data, '匯率'))
        from public.expense_items i
        where i.report_id = target_report_id
          and upper(coalesce(i.data ->> '幣別', '')) = 'USD'
      ), 0),
      1
    )
    into header, days_count, usd_rate
  from public.reports where id = target_report_id for update;
  if not found then raise exception 'Report not found'; end if;

  for row in
    select category,
      sum(case when category in ('Accommodation','Rental Car')
        then public.jsonb_number(data, 'TWD總體金額', 'TWD總額')
        else public.jsonb_number(data, 'TWD金額') end) as overall,
      sum(case when category in ('Accommodation','Rental Car')
        then public.jsonb_number(data, 'TWD個人金額', 'TWD個人')
        else public.jsonb_number(data, 'TWD金額') end) as personal
    from public.expense_items where report_id = target_report_id group by category
  loop
    amount := coalesce(row.overall, 0);
    personal := coalesce(row.personal, 0);
    if row.category = 'Advance Payment' then
      advance_total := amount;
    else
      grand := grand + amount;
      personal_grand := personal_grand + personal;
    end if;
    twd_key := case row.category
        when 'Flight' then '機票費總額'
        when 'Accommodation' then '總體住宿費總額'
        when 'Rental Car' then '總體租車費總額'
        when 'Transportation' then '交通運輸費總額'
        when 'Gas' then '瓦斯費總額'
        when 'Parking' then '停車費總額'
        when 'Internet' then '網路費總額'
        when 'Social' then '社交費總額'
        when 'Gift' then '禮品費總額'
        when 'Luggage Fee' then '行李費總額'
        when 'Handing Fee' then '手續費總額'
        when 'Per Diem' then '日支費總額'
        when 'Advance Payment' then '預支費用總額'
        when 'Lunch & Learn' then '午餐與學費總額'
        else '其他費用總額'
      end;
    usd_key := case row.category
        when 'Flight' then '機票費USD總額'
        when 'Accommodation' then '總體住宿費USD總額'
        when 'Rental Car' then '總體租車費USD總額'
        when 'Transportation' then '交通運輸費USD總額'
        when 'Gas' then '瓦斯費USD總額'
        when 'Parking' then '停車費USD總額'
        when 'Internet' then '網路費USD總額'
        when 'Social' then '社交費USD總額'
        when 'Gift' then '禮品費USD總額'
        when 'Luggage Fee' then '行李費USD總額'
        when 'Handing Fee' then '手續費USD總額'
        when 'Per Diem' then '日支費USD總額'
        when 'Advance Payment' then '預支費用USD總額'
        when 'Lunch & Learn' then '午餐與學費USD總額'
        else '其他費用USD總額'
      end;
    totals := totals || jsonb_build_object(
      twd_key, round(amount),
      usd_key, round(amount / usd_rate, 2)
    );
    if row.category = 'Accommodation' then
      totals := totals || jsonb_build_object(
        '個人住宿費總額', round(personal),
        '個人住宿費USD總額', round(personal / usd_rate, 2)
      );
    elsif row.category = 'Rental Car' then
      totals := totals || jsonb_build_object(
        '個人租車費總額', round(personal),
        '個人租車費USD總額', round(personal / usd_rate, 2)
      );
    end if;
  end loop;

  totals := totals || jsonb_build_object(
    'USD匯率', usd_rate,
    '合計TWD個人總額', round(personal_grand),
    '合計TWD總體總額', round(grand),
    '預支費用總額', round(advance_total),
    '合計USD個人總額', round(personal_grand / usd_rate, 2),
    '合計USD總體總額', round(grand / usd_rate, 2),
    '合計TWD個人平均', case when days_count > 0 then round(personal_grand / days_count) else round(personal_grand) end,
    '合計TWD總體平均', case when days_count > 0 then round(grand / days_count) else round(grand) end,
    '合計USD個人平均', case when days_count > 0 then round(personal_grand / usd_rate / days_count, 2) else round(personal_grand / usd_rate, 2) end,
    '合計USD總體平均', case when days_count > 0 then round(grand / usd_rate / days_count, 2) else round(grand / usd_rate, 2) end
  );
  update public.reports set data = data || totals where id = target_report_id;
end;
$$;

-- Preserve the original security boundary after replacing the function body.
revoke execute on function public.recalculate_report(text) from public;
grant execute on function public.recalculate_report(text) to service_role;
