CREATE FUNCTION touch_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE FUNCTION preserve_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Evidence is append-only; retain corrections separately'; END $$;
CREATE TABLE sites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE CHECK(length(trim(name))>0),
 source_key text NOT NULL, vendor_site_id text NOT NULL, owner text NOT NULL CHECK(length(trim(owner))>0),
 purpose text NOT NULL CHECK(length(trim(purpose))>0), retention_days integer NOT NULL CHECK(retention_days BETWEEN 1 AND 3650),
 access_review_due date NOT NULL, privacy_review_due date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_key,vendor_site_id)
);
CREATE TABLE imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES sites,
 fingerprint text NOT NULL, source_ref text NOT NULL, expected_count integer NOT NULL CHECK(expected_count>0),
 added integer NOT NULL CHECK(added>=0), actor text NOT NULL, from_date date NOT NULL, to_date date NOT NULL CHECK(to_date>=from_date),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(site_id,fingerprint)
);
CREATE TABLE visits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES sites, import_id uuid NOT NULL REFERENCES imports,
 source_visit_id text NOT NULL, started_at timestamptz NOT NULL, channel text NOT NULL, referrer text NOT NULL,
 device text NOT NULL, country text NOT NULL, reported_actions integer NOT NULL CHECK(reported_actions>=0),
 detail_count integer NOT NULL CHECK(detail_count>=0), converted boolean NOT NULL, duration_seconds integer NOT NULL CHECK(duration_seconds>=0),
 record_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(site_id,source_visit_id)
);
CREATE TABLE pageviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL REFERENCES visits,
 position integer NOT NULL CHECK(position>0), page_path text NOT NULL, seconds integer NOT NULL CHECK(seconds>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(visit_id,position)
);
CREATE TABLE actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES sites, title text NOT NULL CHECK(length(trim(title))>0),
 page_path text, owner text NOT NULL CHECK(length(trim(owner))>0), due date NOT NULL,
 state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')), created_by text NOT NULL,
 closure_evidence text, closed_by text, closed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((state='open' AND closed_at IS NULL) OR (state='closed' AND length(trim(closure_evidence))>0 AND length(trim(closed_by))>0 AND closed_at IS NOT NULL))
);
CREATE TABLE notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES sites, actor text NOT NULL, body text NOT NULL CHECK(length(trim(body))>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL, kind text NOT NULL, actor text NOT NULL, detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['sites','imports','visits','pageviews','actions','notes','events'] LOOP
 EXECUTE format('CREATE TRIGGER touch_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated()',t);
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM public',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['imports','visits','pageviews','notes','events'] LOOP
 EXECUTE format('CREATE TRIGGER preserve_evidence BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION preserve_evidence()',t);
 END LOOP;
END $$;
CREATE INDEX visits_site_time ON visits(site_id,started_at);
CREATE INDEX pageviews_visit ON pageviews(visit_id);
CREATE VIEW visit_facts AS
SELECT v.*,s.name site,
 (SELECT p.page_path FROM pageviews p WHERE p.visit_id=v.id ORDER BY p.position LIMIT 1) landing,
 (SELECT count(*)::integer FROM pageviews p WHERE p.visit_id=v.id) page_count,
 v.detail_count>=v.reported_actions details_complete
FROM visits v JOIN sites s ON s.id=v.site_id;
CREATE VIEW acquisition_review AS
SELECT site,channel,count(*)::integer visits,count(*) FILTER(WHERE converted)::integer converted_visits,
 round(100.0*count(*) FILTER(WHERE converted)/nullif(count(*),0),2) conversion_pct
FROM visit_facts GROUP BY site,channel;
CREATE VIEW landing_review AS
SELECT site,landing,count(*)::integer visits,count(*) FILTER(WHERE converted)::integer converted_visits,
 count(*) FILTER(WHERE reported_actions=1)::integer single_action_visits,
 round(100.0*count(*) FILTER(WHERE converted)/nullif(count(*),0),2) conversion_pct
FROM visit_facts WHERE details_complete AND landing IS NOT NULL GROUP BY site,landing;
CREATE VIEW action_review AS
SELECT a.*,s.name site,a.state='open' AND a.due<current_date overdue FROM actions a JOIN sites s ON s.id=a.site_id;
CREATE VIEW compliance_findings AS
SELECT s.id site_id,s.name site,'access-review' rule,'Access review is overdue' finding FROM sites s WHERE access_review_due<current_date
UNION ALL SELECT id,name,'privacy-review','Privacy review is overdue' FROM sites WHERE privacy_review_due<current_date
UNION ALL SELECT s.id,s.name,'retention-review',count(v.id)::text||' visits exceed the configured retention period' FROM sites s JOIN visits v ON v.site_id=s.id WHERE v.started_at<current_date-s.retention_days GROUP BY s.id,s.name
UNION ALL SELECT site_id,site,'incomplete-export',count(*)::text||' visits have fewer action details than reported actions' FROM visit_facts WHERE NOT details_complete GROUP BY site_id,site;
CREATE VIEW attention_review AS
SELECT site_id,site,'overdue-action' kind,title detail FROM action_review WHERE overdue
UNION ALL SELECT site_id,site,rule,finding FROM compliance_findings
UNION ALL SELECT s.id,s.name,'stale-import','No import recorded in seven days' FROM sites s LEFT JOIN imports i ON i.site_id=s.id GROUP BY s.id,s.name HAVING max(i.created_at)<now()-interval '7 days' OR count(i.id)=0;
