"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseDemo } from "@/lib/supabaseDemo";
import Workspace, { type Sample } from "@/app/components/Workspace";

const SAMPLE: Sample = {
  filename: "Sample residential lease.txt",
  content: `RESIDENTIAL LEASE AGREEMENT

1. TERM. This lease begins on January 1 and continues for a fixed term of twelve (12) months.

2. RENT. Tenant shall pay rent of $2,100 per month, due on the 1st day of each month.

3. LATE PAYMENT. If rent is not received by the 4th day of the month, Tenant shall pay a late fee of $150, plus $15 for each additional day the rent remains unpaid.

4. AUTOMATIC RENEWAL. At the end of the term, this lease automatically renews on a month-to-month basis unless either party gives written notice of non-renewal at least sixty (60) days before the end of the term. Upon renewal, rent may increase by up to 8%.

5. EARLY TERMINATION. If Tenant ends this lease before the end of the term, Tenant shall pay an early termination fee equal to two (2) months' rent and forfeits the security deposit. Tenant remains responsible for rent until the unit is re-rented.

6. SECURITY DEPOSIT. Tenant shall pay a security deposit of $2,100. A non-refundable cleaning fee of $400 is also required and will not be returned under any circumstances.

7. ENTRY BY LANDLORD. Landlord may enter the premises for inspection or repairs with twenty-four (24) hours notice, and without notice in the event of an emergency.

8. MAINTENANCE. Tenant is responsible for all repairs under $200 per occurrence. Landlord is responsible for major structural repairs only.

9. JOINT AND SEVERAL LIABILITY. Where there is more than one Tenant, each Tenant is jointly and severally liable for the full amount of rent and any damages, meaning any one Tenant may be held responsible for the entire obligation.

10. LATE FEES AND EVICTION. If rent is more than ten (10) days late, Landlord may begin eviction proceedings, and Tenant shall be responsible for all associated legal and court costs.

11. PETS. No pets are permitted without written consent and a non-refundable pet fee of $500 per pet.

12. GOVERNING LAW. This agreement is governed by the laws of the Province of Ontario.`,
};

export default function DemoPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    const { data: sub } = supabaseDemo.auth.onAuthStateChange((_e, s) => setSession(s));
    (async () => {
      const { data } = await supabaseDemo.auth.getSession();
      if (data.session) {
        setSession(data.session);
        return;
      }
      if (startedRef.current) return;
      startedRef.current = true;
      const { error } = await supabaseDemo.auth.signInAnonymously();
      if (error) setError(error.message);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  if (error) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">§</div>
          <h1 className="auth-title">Demo unavailable</h1>
          <p className="auth-sub">The demo could not start. You can still create a free account.</p>
          <div className="auth-msg err">{error}</div>
          <a className="auth-btn" href="/app" style={{ textDecoration: "none", display: "block", textAlign: "center" }}>Go to sign up</a>
          <a className="auth-home" href="/">&larr; Back to home</a>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">§</div>
          <h1 className="auth-title">Starting the demo…</h1>
          <p className="auth-sub">Loading a sample contract for you.</p>
        </div>
      </div>
    );
  }

  return <Workspace session={session} client={supabaseDemo} demo sample={SAMPLE} key={session.user.id} />;
}
