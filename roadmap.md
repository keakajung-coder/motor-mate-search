# Roadmap

- [ ] Security: fix findings business_tables_anon_write_access, customers_public_exposure, storage_objects_no_rls_policies (storage policies + revoke anon DELETE; mark via manage_security_finding)
- [ ] Calendar UI refactor (src/routes/planner.tsx): Sun ~3% red bar, Sat ~10%, Mon–Fri equal, h-scroll; card borders (vehicle 3px, technician pastel bg, text-slate-800); monthly = customer only, max-h-24 scroll; weekly = AM/PM split with lunch divider, card layout time+tech top-left / customer bold / details
