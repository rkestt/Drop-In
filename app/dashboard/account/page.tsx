import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmailVerification } from "@/components/account/email-verification";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { DeleteAccount } from "@/components/account/delete-account";

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?login=required");
  }

  const isVerified = !!user.email_confirmed_at;
  const provider = user.app_metadata?.provider as string | undefined;
  const isEmailUser = provider === "email" || !provider;

  return (
    <main className="px-4 pt-5 pb-8">
      <div className="max-w-[720px] mx-auto">
        {/* Back link */}
        <Link
          href="/dashboard/profile"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Profilo</span>
        </Link>

        {/* Page title */}
        <h1 className="text-3xl font-bold font-[family-name:var(--font-syne)] mb-6 animate-fade-in">
          Account
        </h1>

        {/* Email verification */}
        <div className="mb-4 animate-fade-in">
          <EmailVerification
            email={user.email ?? ""}
            isVerified={isVerified}
          />
        </div>

        {/* Change password — only for email/password users */}
        {isEmailUser && (
          <div className="mb-4 animate-fade-in">
            <ChangePasswordForm />
          </div>
        )}

        {/* Delete account */}
        <div className="animate-fade-in">
          <DeleteAccount userId={user.id} />
        </div>
      </div>
    </main>
  );
}
