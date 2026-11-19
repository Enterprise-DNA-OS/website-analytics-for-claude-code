# Analytics record controls

Checked 19 November 2026. These are operational checks for an owner reviewing website information. They do not certify compliance or choose the applicable law. The owner sets the purpose, access, lawful collection method, retention period and response process.

| Check | Implemented rule | Source and boundary |
|---|---|---|
| access-review | Flag a site's access_review_due before today | [NZ Privacy Act principle 5](https://www.privacy.org.nz/privacy-principles/5/) concerns reasonable safeguards. The review schedule is a local operating policy, not a statutory interval. |
| privacy-review | Flag a site's privacy_review_due before today | A local review control supporting the recorded purpose and safeguards. It does not inspect the website's notice, consent mechanism or contracts. |
| retention-review | Count visits older than the site's configured retention_days | [NZ Privacy Act principle 9](https://www.privacy.org.nz/privacy-principles/9/) limits holding personal information longer than needed for its lawful purpose. No universal number of days is prescribed here. The owner chooses the period. |
| incomplete-export | Flag saved action-detail counts below the reported action count | [Matomo raw export documentation](https://matomo.org/faq/how-to/faq_24536/) describes action limits. This is an evidence-quality control, not a legal rule. |
| overdue-action | Surface open work past its due date | Local operational policy, not a statutory deadline. |
| stale-import | Surface sites without an import in seven days | Local weekly review policy. This checks arrival time, not proof of fresh or complete source data. Read coverage too. |

## Data handling

Imports discard IP addresses, visitor and user identifiers, coordinates, page titles, URL queries and fragments. Paths, referrer labels, source visit IDs and operator notes remain potentially identifying. Review them before import. Reports, drafts and exports use private file modes where the operating system supports them. Windows access depends on filesystem permissions. The database role is trusted and is not a multi-user identity service.

The evidence tables reject routine updates and deletes. That protects the review trail but is not a retention policy. An authorised administrator must implement reviewed archival or erasure, including backups and generated documents, when required. Database owners can bypass triggers. The tool never deletes automatically or declares that holding records forever is compliant.

## What a review must cover outside this tool

Check the actual site's collection settings, notices, consent obligations, access controls, hosting arrangements and incident response. This base does not track browsers or configure consent. Australian or other jurisdictional requirements need a separate assessment before deployment. Typed actor names record attribution; they do not authenticate the person. A clean command output means only that these recorded checks found no exceptions.
