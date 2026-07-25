
-- Reaper telemetry tables
CREATE TABLE public.reaper_nodes (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('online','offline','degraded')),
  ping_ms INTEGER,
  version TEXT NOT NULL,
  uptime_s BIGINT NOT NULL DEFAULT 0,
  last_ping TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reaper_nodes TO anon, authenticated;
GRANT ALL ON public.reaper_nodes TO service_role;
ALTER TABLE public.reaper_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read nodes" ON public.reaper_nodes FOR SELECT USING (true);

CREATE TABLE public.reaper_activity (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('deploy','info','warn','error')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reaper_activity TO anon, authenticated;
GRANT ALL ON public.reaper_activity TO service_role;
ALTER TABLE public.reaper_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read activity" ON public.reaper_activity FOR SELECT USING (true);
CREATE INDEX idx_activity_created ON public.reaper_activity (created_at DESC);

CREATE TABLE public.reaper_queue (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  eta_seconds INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'running',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reaper_queue TO anon, authenticated;
GRANT ALL ON public.reaper_queue TO service_role;
ALTER TABLE public.reaper_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read queue" ON public.reaper_queue FOR SELECT USING (true);

CREATE TABLE public.reaper_perf (
  id BIGSERIAL PRIMARY KEY,
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success_rate NUMERIC(5,2) NOT NULL,
  latency_ms INTEGER NOT NULL
);
GRANT SELECT ON public.reaper_perf TO anon, authenticated;
GRANT ALL ON public.reaper_perf TO service_role;
ALTER TABLE public.reaper_perf ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read perf" ON public.reaper_perf FOR SELECT USING (true);
CREATE INDEX idx_perf_sampled ON public.reaper_perf (sampled_at DESC);

-- Seed initial fleet
INSERT INTO public.reaper_nodes (id, region, status, ping_ms, version, uptime_s) VALUES
  ('NODE-001','us-east','online',12,'v7.3.1',348211),
  ('NODE-002','us-west','online',18,'v7.3.1',312044),
  ('NODE-003','eu-central','degraded',412,'v7.2.9',87211),
  ('NODE-004','ap-south','offline',NULL,'v7.2.9',0),
  ('NODE-005','sa-east','online',24,'v7.3.1',201533),
  ('NODE-006','us-east','online',9,'v7.3.1',412000),
  ('NODE-007','eu-west','degraded',298,'v7.3.0',66120),
  ('NODE-008','ap-northeast','online',31,'v7.3.1',298711);

INSERT INTO public.reaper_queue (id, label, progress, eta_seconds) VALUES
  ('TASK-8821','Deploy v7.3.2 -> us-east cluster',12,720),
  ('TASK-8822','Rotate signing keys -> eu-central',4,1800),
  ('TASK-8823','Telemetry backfill -> NODE-004',0,3600),
  ('TASK-8824','Canary rollout -> ap-south (5%)',0,4200);

INSERT INTO public.reaper_activity (node_id, event_type, message) VALUES
  ('NODE-002','deploy','Payload 7 completed on NODE-002'),
  (NULL,'info','Fleet handshake sweep OK'),
  ('NODE-003','warn','NODE-003 latency exceeded 400ms threshold'),
  ('NODE-004','error','Connection lost - NODE-004'),
  (NULL,'deploy','Rolling deployment initiated (batch #219)');

-- Seed 60 initial perf samples spaced 1 min back
INSERT INTO public.reaper_perf (sampled_at, success_rate, latency_ms)
SELECT now() - (i || ' minutes')::interval,
       92 + (random()*6)::numeric(5,2),
       120 + (random()*60)::int
FROM generate_series(59, 0, -1) i;

-- Tick function: advances telemetry realistically each call
CREATE OR REPLACE FUNCTION public.reaper_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n RECORD;
  q RECORD;
  new_progress INTEGER;
  new_status TEXT;
  msgs TEXT[] := ARRAY[
    'Heartbeat sweep OK',
    'Telemetry checkpoint written',
    'Payload executed',
    'Cert rotation completed',
    'Queue depth normalized',
    'Node registered - handshake OK'
  ];
  warns TEXT[] := ARRAY[
    'Latency exceeded threshold',
    'Queue depth > 24',
    'Retry backoff engaged'
  ];
BEGIN
  -- Update each node
  FOR n IN SELECT * FROM reaper_nodes LOOP
    new_status := n.status;
    IF n.status = 'offline' THEN
      IF random() < 0.15 THEN new_status := 'degraded'; END IF;
    ELSIF n.status = 'degraded' THEN
      IF random() < 0.4 THEN new_status := 'online';
      ELSIF random() < 0.05 THEN new_status := 'offline';
      END IF;
    ELSE
      IF random() < 0.05 THEN new_status := 'degraded'; END IF;
    END IF;

    UPDATE reaper_nodes
      SET status = new_status,
          ping_ms = CASE
            WHEN new_status = 'offline' THEN NULL
            WHEN new_status = 'degraded' THEN 200 + (random()*250)::int
            ELSE 8 + (random()*40)::int
          END,
          uptime_s = CASE WHEN new_status = 'offline' THEN 0 ELSE n.uptime_s + 60 END,
          last_ping = now(),
          updated_at = now()
      WHERE id = n.id;

    IF new_status <> n.status THEN
      INSERT INTO reaper_activity (node_id, event_type, message)
      VALUES (n.id,
              CASE WHEN new_status = 'offline' THEN 'error'
                   WHEN new_status = 'degraded' THEN 'warn'
                   ELSE 'info' END,
              n.id || ' status -> ' || new_status);
    END IF;
  END LOOP;

  -- Advance queue
  FOR q IN SELECT * FROM reaper_queue LOOP
    new_progress := LEAST(100, q.progress + (5 + (random()*15))::int);
    IF new_progress >= 100 THEN
      INSERT INTO reaper_activity (event_type, message)
      VALUES ('deploy', q.label || ' - completed');
      DELETE FROM reaper_queue WHERE id = q.id;
    ELSE
      UPDATE reaper_queue
        SET progress = new_progress,
            eta_seconds = GREATEST(0, q.eta_seconds - 60),
            updated_at = now()
        WHERE id = q.id;
    END IF;
  END LOOP;

  -- Refill queue if empty-ish
  IF (SELECT count(*) FROM reaper_queue) < 3 THEN
    INSERT INTO reaper_queue (id, label, progress, eta_seconds)
    VALUES ('TASK-' || (8800 + (random()*200)::int)::text,
            'Payload rollout -> ' || (SELECT region FROM reaper_nodes ORDER BY random() LIMIT 1),
            0, 600 + (random()*3000)::int)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Random activity
  IF random() < 0.7 THEN
    INSERT INTO reaper_activity (event_type, message)
    VALUES ('info', msgs[1 + (random()*(array_length(msgs,1)-1))::int]);
  END IF;
  IF random() < 0.25 THEN
    INSERT INTO reaper_activity (event_type, message)
    VALUES ('warn', warns[1 + (random()*(array_length(warns,1)-1))::int]);
  END IF;

  -- Perf sample
  INSERT INTO reaper_perf (success_rate, latency_ms)
  VALUES (
    GREATEST(78, LEAST(99.9, 92 + (random()*6 - 1)::numeric(5,2))),
    120 + (random()*60)::int
  );

  -- Prune
  DELETE FROM reaper_activity WHERE id IN (
    SELECT id FROM reaper_activity ORDER BY created_at DESC OFFSET 200
  );
  DELETE FROM reaper_perf WHERE id IN (
    SELECT id FROM reaper_perf ORDER BY sampled_at DESC OFFSET 240
  );
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reaper_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reaper_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reaper_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reaper_perf;

-- Schedule tick every minute
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('reaper-tick', '* * * * *', $$SELECT public.reaper_tick();$$);
