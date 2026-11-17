import { AuthForm } from "../../auth-form";
import { resetPasswordAction } from "../../actions";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-muted">You&apos;ll be signed out of other devices.</p>
      <AuthForm testId="reset-form" action={resetPasswordAction} submit="Update password" hidden={{ token }}
        fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 10 characters, with a letter and a number." }]} />
    </>
  );
}
