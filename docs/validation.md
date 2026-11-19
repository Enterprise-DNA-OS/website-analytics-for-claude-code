# Validation

Execution results are recorded here after the local and hosted checks finish. The workflow runs the same smoke suite on Windows and Linux with Node 20 and 22, plus PostgreSQL 17. Tests use synthetic records and an isolated database.

The suite covers every CLI verb, source and site isolation, independent import counts, duplicate and conflicting visits, dry-run rollback, source-date bounds, converted-visit denominators, incomplete action histories, repeated seed and migrations, private drafts, export overwrite protection, evidence controls and escaped HTML.
