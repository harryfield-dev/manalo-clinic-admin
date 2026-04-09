# Dynamic Admin Site TODO

## Plan Progress

✅ **Step 1:** Create TODO.md with steps  
✅ **Step 2:** Create `src/app/hooks/useAppointments.ts` - fetch + realtime sub for appointments  
✅ **Step 3:** Create `src/app/hooks/useDoctors.ts` - fetch active doctors  
✅ **Step 4:** Update `AppointmentsPage.tsx` - replace mock data with hooks + mutations  
✅ **Step 5:** Update `DashboardPage.tsx` - dynamic queue, charts, KPIs from appointments

**Next Steps:**

- [ ] **Step 6:** Test: Insert test appointment in Supabase → verify realtime update in admin
- [ ] **Step 6:** Test: Insert test appointment in Supabase → verify realtime update in admin
- [ ] **Step 7:** Update other pages (Patients, Doctors) to use hooks
- [ ] **Step 8:** Remove mockData dependencies
- [ ] **Step 9:** Complete - attempt_completion

**Notes:**
- Assumes Supabase tables: `appointments`, `doctors`, `patients`
- Realtime via `postgres_changes` on inserts/updates
- Mutations: upsert/insert/update via Supabase client
