-- Phase 8: Admin predictive analytics (deterministic, aggregated, no PII).
--
-- Provides get_admin_predictive_analytics() for Admin AI Insights / Dashboard.
-- Admin-only. Returns facts, forecasts, shortage risk, and site geography.
-- Does NOT call external AI, mutate inventory/requests, or expose donor/recipient PII.

create or replace function public.get_admin_predictive_analytics()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_lookback_start timestamptz := date_trunc('week', now()) - interval '11 weeks';
  v_recent_start timestamptz := now() - interval '28 days';
  v_min_forecast_weeks integer := 4;
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not public.is_admin() then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  with
  -- Current inventory facts (canonical stable/low/critical model)
  inventory_rows as (
    select
      bi.blood_type,
      bi.quantity,
      bi.stock_status,
      bi.bloodbank_id,
      bi.low_threshold,
      bi.critical_threshold
    from public.blood_inventory bi
  ),
  inventory_by_type as (
    select
      bt.blood_type,
      coalesce(sum(ir.quantity), 0)::integer as units,
      count(*) filter (where ir.stock_status = 'critical')::integer as critical_rows,
      count(*) filter (where ir.stock_status = 'low')::integer as low_rows,
      count(*) filter (where ir.stock_status = 'stable')::integer as stable_rows
    from (select unnest(enum_range(null::public.blood_type)) as blood_type) bt
    left join inventory_rows ir on ir.blood_type = bt.blood_type
    group by bt.blood_type
  ),
  inventory_banks as (
    select
      ir.bloodbank_id,
      bool_or(ir.stock_status = 'critical') as has_critical,
      bool_or(ir.stock_status = 'low') as has_low
    from inventory_rows ir
    group by ir.bloodbank_id
  ),
  inventory_summary as (
    select json_build_object(
      'total_units', coalesce((select sum(units)::integer from inventory_by_type), 0),
      'banks_tracked', coalesce((select count(*)::integer from inventory_banks), 0),
      'banks_with_critical', coalesce((select count(*)::integer from inventory_banks where has_critical), 0),
      'banks_with_low', coalesce((select count(*)::integer from inventory_banks where has_low and not has_critical), 0),
      'critical_rows', coalesce((select sum(critical_rows)::integer from inventory_by_type), 0),
      'low_rows', coalesce((select sum(low_rows)::integer from inventory_by_type), 0),
      'stable_rows', coalesce((select sum(stable_rows)::integer from inventory_by_type), 0),
      'by_blood_type', coalesce(
        (
          select json_agg(
            json_build_object(
              'blood_type', ibt.blood_type::text,
              'units', ibt.units,
              'critical_rows', ibt.critical_rows,
              'low_rows', ibt.low_rows,
              'stable_rows', ibt.stable_rows
            )
            order by ibt.blood_type::text
          )
          from inventory_by_type ibt
        ),
        '[]'::json
      )
    ) as payload
  ),

  -- Recent operational demand/supply facts (28 days)
  recent_requests as (
    select
      br.blood_type,
      count(*)::integer as request_count,
      coalesce(sum(br.units_needed), 0)::integer as units_requested,
      count(*) filter (where br.status = 'open')::integer as open_count,
      count(*) filter (where br.status in ('open', 'matched'))::integer as active_count,
      count(*) filter (where br.urgency in ('urgent', 'critical'))::integer as urgent_count
    from public.blood_requests br
    where br.created_at >= v_recent_start
      and br.status <> 'draft'
    group by br.blood_type
  ),
  recent_donations as (
    select
      br.blood_type,
      count(*)::integer as completed_count,
      coalesce(sum(coalesce(d.units_donated, 1)), 0)::integer as units_completed
    from public.donations d
    join public.blood_requests br on br.id = d.request_id
    where d.status = 'completed'
      and coalesce(d.completed_at, d.updated_at, d.created_at) >= v_recent_start
    group by br.blood_type
  ),
  recent_by_type as (
    select
      bt.blood_type,
      coalesce(rr.request_count, 0) as request_count,
      coalesce(rr.units_requested, 0) as units_requested,
      coalesce(rr.open_count, 0) as open_count,
      coalesce(rr.active_count, 0) as active_count,
      coalesce(rr.urgent_count, 0) as urgent_count,
      coalesce(rd.completed_count, 0) as completed_donations,
      coalesce(rd.units_completed, 0) as units_completed
    from (select unnest(enum_range(null::public.blood_type)) as blood_type) bt
    left join recent_requests rr on rr.blood_type = bt.blood_type
    left join recent_donations rd on rd.blood_type = bt.blood_type
  ),
  recent_activity as (
    select json_build_object(
      'window_days', 28,
      'request_count', coalesce((select sum(request_count)::integer from recent_by_type), 0),
      'units_requested', coalesce((select sum(units_requested)::integer from recent_by_type), 0),
      'open_request_count', coalesce((select sum(open_count)::integer from recent_by_type), 0),
      'active_request_count', coalesce((select sum(active_count)::integer from recent_by_type), 0),
      'urgent_request_count', coalesce((select sum(urgent_count)::integer from recent_by_type), 0),
      'completed_donations', coalesce((select sum(completed_donations)::integer from recent_by_type), 0),
      'units_completed', coalesce((select sum(units_completed)::integer from recent_by_type), 0),
      'by_blood_type', coalesce(
        (
          select json_agg(
            json_build_object(
              'blood_type', r.blood_type::text,
              'request_count', r.request_count,
              'units_requested', r.units_requested,
              'open_count', r.open_count,
              'active_count', r.active_count,
              'urgent_count', r.urgent_count,
              'completed_donations', r.completed_donations,
              'units_completed', r.units_completed,
              'supply_demand_gap', r.units_requested - r.units_completed
            )
            order by r.blood_type::text
          )
          from recent_by_type r
        ),
        '[]'::json
      )
    ) as payload
  ),

  -- Weekly history for transparent forecasting (last 12 calendar weeks incl. current)
  week_spine as (
    select generate_series(
      date_trunc('week', v_lookback_start),
      date_trunc('week', v_now),
      interval '1 week'
    )::date as week_start
  ),
  weekly_demand as (
    select
      date_trunc('week', br.created_at)::date as week_start,
      coalesce(sum(br.units_needed), 0)::integer as units_requested,
      count(*)::integer as request_count
    from public.blood_requests br
    where br.created_at >= v_lookback_start
      and br.status <> 'draft'
    group by 1
  ),
  weekly_supply as (
    select
      date_trunc('week', coalesce(d.completed_at, d.updated_at, d.created_at))::date as week_start,
      coalesce(sum(coalesce(d.units_donated, 1)), 0)::integer as units_completed,
      count(*)::integer as completed_count
    from public.donations d
    where d.status = 'completed'
      and coalesce(d.completed_at, d.updated_at, d.created_at) >= v_lookback_start
    group by 1
  ),
  weekly_series as (
    select
      ws.week_start,
      coalesce(wd.units_requested, 0) as units_requested,
      coalesce(wd.request_count, 0) as request_count,
      coalesce(wsu.units_completed, 0) as units_completed,
      coalesce(wsu.completed_count, 0) as completed_count
    from week_spine ws
    left join weekly_demand wd on wd.week_start = ws.week_start
    left join weekly_supply wsu on wsu.week_start = ws.week_start
  ),
  weekly_nonzero_demand as (
    select count(*)::integer as weeks_with_demand
    from weekly_series
    where units_requested > 0
  ),
  weekly_nonzero_supply as (
    select count(*)::integer as weeks_with_supply
    from weekly_series
    where units_completed > 0
  ),
  -- Simple moving average of the last 4 weeks (transparent methodology)
  sma4 as (
    select
      round(avg(units_requested)::numeric, 2) as demand_sma4,
      round(avg(units_completed)::numeric, 2) as supply_sma4
    from (
      select units_requested, units_completed
      from weekly_series
      order by week_start desc
      limit 4
    ) recent4
  ),
  forecast_block as (
    select json_build_object(
      'methodology',
        'Weekly units from blood_requests (demand) and completed donations (supply). '
        || 'Forecast uses a 4-week simple moving average when at least 4 weeks contain observations. '
        || 'Current inventory is reported separately and is not treated as future supply.',
      'horizon_weeks', 4,
      'min_weeks_required', v_min_forecast_weeks,
      'history', coalesce(
        (
          select json_agg(
            json_build_object(
              'week_start', w.week_start,
              'units_requested', w.units_requested,
              'request_count', w.request_count,
              'units_completed', w.units_completed,
              'completed_count', w.completed_count
            )
            order by w.week_start
          )
          from weekly_series w
        ),
        '[]'::json
      ),
      'demand', json_build_object(
        'sufficient', (select weeks_with_demand >= v_min_forecast_weeks from weekly_nonzero_demand),
        'weeks_with_data', (select weeks_with_demand from weekly_nonzero_demand),
        'forecasted_weekly_units',
          case
            when (select weeks_with_demand from weekly_nonzero_demand) >= v_min_forecast_weeks
              then (select demand_sma4 from sma4)
            else null
          end,
        'message',
          case
            when (select weeks_with_demand from weekly_nonzero_demand) >= v_min_forecast_weeks
              then 'Forecasted demand is the 4-week simple moving average of requested units.'
            else 'Insufficient historical data for reliable demand forecasting.'
          end
      ),
      'supply', json_build_object(
        'sufficient', (select weeks_with_supply >= v_min_forecast_weeks from weekly_nonzero_supply),
        'weeks_with_data', (select weeks_with_supply from weekly_nonzero_supply),
        'forecasted_weekly_units',
          case
            when (select weeks_with_supply from weekly_nonzero_supply) >= v_min_forecast_weeks
              then (select supply_sma4 from sma4)
            else null
          end,
        'message',
          case
            when (select weeks_with_supply from weekly_nonzero_supply) >= v_min_forecast_weeks
              then 'Predicted future supply is the 4-week simple moving average of completed donation units (separate from current inventory).'
            else 'Insufficient historical data for reliable supply forecasting.'
          end
      ),
      'summary', json_build_object(
        'current_inventory_units', coalesce((select sum(units)::integer from inventory_by_type), 0),
        'forecasted_demand_units',
          case
            when (select weeks_with_demand from weekly_nonzero_demand) >= v_min_forecast_weeks
              then (select demand_sma4 from sma4)
            else null
          end,
        'forecasted_supply_units',
          case
            when (select weeks_with_supply from weekly_nonzero_supply) >= v_min_forecast_weeks
              then (select supply_sma4 from sma4)
            else null
          end,
        'potential_weekly_deficit',
          case
            when (select weeks_with_demand from weekly_nonzero_demand) >= v_min_forecast_weeks
              then round(
                (select demand_sma4 from sma4)
                - coalesce(
                    case
                      when (select weeks_with_supply from weekly_nonzero_supply) >= v_min_forecast_weeks
                        then (select supply_sma4 from sma4)
                      else 0
                    end,
                    0
                  ),
                2
              )
            else null
          end
      )
    ) as payload
  ),

  -- Per blood-type shortage risk (inventory status + recent demand gap)
  risk_by_type as (
    select
      ibt.blood_type,
      ibt.units as inventory_units,
      ibt.critical_rows,
      ibt.low_rows,
      coalesce(r.units_requested, 0) as recent_units_requested,
      coalesce(r.units_completed, 0) as recent_units_completed,
      coalesce(r.units_requested, 0) - coalesce(r.units_completed, 0) as recent_gap,
      case
        when ibt.critical_rows > 0
          or (coalesce(r.units_requested, 0) - coalesce(r.units_completed, 0)) >= 10
          then 'high'
        when ibt.low_rows > 0
          or (coalesce(r.units_requested, 0) - coalesce(r.units_completed, 0)) >= 3
          or (ibt.units = 0 and coalesce(r.units_requested, 0) > 0)
          then 'moderate'
        else 'low'
      end as risk_level
    from inventory_by_type ibt
    left join recent_by_type r on r.blood_type = ibt.blood_type
  ),
  risk_block as (
    select json_build_object(
      'methodology',
        'Risk combines canonical inventory stock_status (critical/low/stable thresholds) '
        || 'with the 28-day gap between requested units and completed donation units. '
        || 'high: any critical inventory rows OR recent gap >= 10 units; '
        || 'moderate: any low inventory rows OR recent gap >= 3 OR zero stock with recent demand; '
        || 'low: otherwise.',
      'overall',
        case
          when exists (select 1 from risk_by_type where risk_level = 'high') then 'high'
          when exists (select 1 from risk_by_type where risk_level = 'moderate') then 'moderate'
          else 'low'
        end,
      'high_risk_blood_types', coalesce(
        (
          select json_agg(r.blood_type::text order by r.blood_type::text)
          from risk_by_type r
          where r.risk_level = 'high'
        ),
        '[]'::json
      ),
      'by_blood_type', coalesce(
        (
          select json_agg(
            json_build_object(
              'blood_type', r.blood_type::text,
              'risk_level', r.risk_level,
              'inventory_units', r.inventory_units,
              'critical_rows', r.critical_rows,
              'low_rows', r.low_rows,
              'recent_units_requested', r.recent_units_requested,
              'recent_units_completed', r.recent_units_completed,
              'recent_gap', r.recent_gap
            )
            order by
              case r.risk_level when 'high' then 0 when 'moderate' then 1 else 2 end,
              r.recent_gap desc,
              r.blood_type::text
          )
          from risk_by_type r
        ),
        '[]'::json
      )
    ) as payload
  ),

  -- Site-level geography (blood banks only; exclude sites missing coordinates)
  site_rows as (
    select
      p.id as bloodbank_id,
      coalesce(
        nullif(trim(bv.hospital_name), ''),
        nullif(trim(p.organization_name), ''),
        nullif(trim(p.full_name), ''),
        'Blood bank'
      ) as display_name,
      bv.branch_location,
      p.address,
      p.latitude,
      p.longitude,
      coalesce(sum(bi.quantity), 0)::integer as total_units,
      count(*) filter (where bi.stock_status = 'critical')::integer as critical_count,
      count(*) filter (where bi.stock_status = 'low')::integer as low_count,
      count(*) filter (where bi.stock_status = 'stable')::integer as stable_count
    from public.profiles p
    left join public.bloodbank_verifications bv
      on bv.profile_id = p.id
     and bv.status = 'approved'
    left join public.blood_inventory bi on bi.bloodbank_id = p.id
    where p.role = 'bloodbank'
      and p.latitude is not null
      and p.longitude is not null
    group by
      p.id,
      bv.hospital_name,
      bv.branch_location,
      p.organization_name,
      p.full_name,
      p.address,
      p.latitude,
      p.longitude
  ),
  sites_excluded as (
    select count(*)::integer as excluded_missing_coordinates
    from public.profiles p
    where p.role = 'bloodbank'
      and (p.latitude is null or p.longitude is null)
  ),
  sites_block as (
    select json_build_object(
      'scope', 'blood_bank_sites_only',
      'included_sites', coalesce((select count(*)::integer from site_rows), 0),
      'excluded_missing_coordinates', (select excluded_missing_coordinates from sites_excluded),
      'note',
        case
          when (select count(*) from site_rows) = 0
            then 'No blood-bank sites with coordinates are available for geographic analysis.'
          else 'Sites without latitude/longitude are excluded rather than invented.'
        end,
      'sites', coalesce(
        (
          select json_agg(
            json_build_object(
              'bloodbank_id', s.bloodbank_id,
              'display_name', s.display_name,
              'branch_location', s.branch_location,
              'address', s.address,
              'latitude', s.latitude,
              'longitude', s.longitude,
              'total_units', s.total_units,
              'critical_count', s.critical_count,
              'low_count', s.low_count,
              'stable_count', s.stable_count,
              'shortage_risk',
                case
                  when s.critical_count > 0 then 'high'
                  when s.low_count > 0 then 'moderate'
                  else 'low'
                end
            )
            order by
              case
                when s.critical_count > 0 then 0
                when s.low_count > 0 then 1
                else 2
              end,
              s.display_name
          )
          from site_rows s
        ),
        '[]'::json
      )
    ) as payload
  ),

  data_quality as (
    select json_build_object(
      'has_inventory_rows', exists (select 1 from inventory_rows),
      'has_recent_requests', exists (select 1 from recent_by_type where request_count > 0),
      'has_completed_donations', exists (select 1 from recent_by_type where completed_donations > 0),
      'has_mappable_sites', exists (select 1 from site_rows),
      'demand_forecast_sufficient', (select weeks_with_demand >= v_min_forecast_weeks from weekly_nonzero_demand),
      'supply_forecast_sufficient', (select weeks_with_supply >= v_min_forecast_weeks from weekly_nonzero_supply),
      'limitations', (
        select coalesce(json_agg(msg), '[]'::json)
        from (
          select 'No blood inventory rows are tracked yet.' as msg
          where not exists (select 1 from inventory_rows)
          union all
          select 'No completed donations in the lookback window — predicted supply is unavailable.'
          where (select weeks_with_supply from weekly_nonzero_supply) < v_min_forecast_weeks
          union all
          select 'Insufficient historical request weeks for reliable demand forecasting.'
          where (select weeks_with_demand from weekly_nonzero_demand) < v_min_forecast_weeks
          union all
          select 'No blood-bank sites with coordinates for geographic comparison.'
          where not exists (select 1 from site_rows)
        ) limitations
      )
    ) as payload
  )

  select json_build_object(
    'generated_at', v_now,
    'layer', 'deterministic',
    'facts', json_build_object(
      'inventory', (select payload from inventory_summary),
      'recent_activity', (select payload from recent_activity)
    ),
    'forecast', (select payload from forecast_block),
    'risk', (select payload from risk_block),
    'geography', (select payload from sites_block),
    'data_quality', (select payload from data_quality)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_admin_predictive_analytics() from public;
revoke all on function public.get_admin_predictive_analytics() from anon;
grant execute on function public.get_admin_predictive_analytics() to authenticated;
grant execute on function public.get_admin_predictive_analytics() to service_role;

comment on function public.get_admin_predictive_analytics() is
  'Admin-only aggregated predictive analytics (facts, SMA forecast, shortage risk, site geography). No PII. Read-only. Execute: authenticated + service_role.';
