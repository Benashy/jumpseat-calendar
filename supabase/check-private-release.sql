-- Read-only release evidence. Returns digests and booleans, not private content.
select b.checklist_key, b.content_sha256, b.pdf_sha256,
  encode(extensions.digest(decode(b.pdf_base64, 'base64'), 'sha256'), 'hex') = b.pdf_sha256 as pdf_bytes_verified,
  b.content_sha256 = case when b.checklist_key = 'gps' then g.content_sha256 else l.content_sha256 end as source_matches
from public.opsdeck_checklist_backups b
left join public.opsdeck_gps_checklist g on g.user_id = b.user_id
left join public.opsdeck_lvto_checklist l on l.user_id = b.user_id
where b.checklist_key in ('gps', 'lvto');
