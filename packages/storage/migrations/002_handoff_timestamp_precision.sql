-- Application timestamps use millisecond precision. Avoid intermittent same-millisecond proof rejection.
ALTER TABLE handoffs ALTER COLUMN prepared_at SET DEFAULT date_trunc('milliseconds', clock_timestamp());
