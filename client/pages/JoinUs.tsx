import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LogIn, PenLine, KeyRound, LogOut } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

function friendlyError(err: unknown, fallback: string): string {
  const raw = String((err as any)?.message || err || "").trim();
  if (!raw) return fallback;
  const technical = [/NetworkError/i, /Failed to fetch/i, /body stream/i, /already read/i, /already used/i, /Unexpected end of JSON/i, /SyntaxError/i, /TypeError/i, /clone/i, /\bResponse\b/i];
  if (technical.some((re) => re.test(raw))) return fallback;
  return raw.length > 140 ? fallback : raw;
}

type AuthUser = { id: string; username: string; email: string };

function SignInForm({ onSignedIn }: { onSignedIn: (user: AuthUser) => void }) {
  const [loading, setLoading] = React.useState(false);
  const identRef = React.useRef<HTMLInputElement>(null);
  const [fpOpen, setFpOpen] = React.useState(false);
  const [fpStep, setFpStep] = React.useState<"otp" | "reset">("otp");
  const [fpLoading, setFpLoading] = React.useState(false);
  const otpRef = React.useRef<HTMLInputElement>(null);
  const newPassRef = React.useRef<HTMLInputElement>(null);
  const confirmPassRef = React.useRef<HTMLInputElement>(null);
  const [fpVerifiedCode, setFpVerifiedCode] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      identifier: String(fd.get("identifier") || "").trim(),
      password: String(fd.get("password") || ""),
    };
    if (!payload.identifier || !payload.password) return;
    setLoading(true);
    try {
      const r = await apiFetch("/api/auth/signin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const raw = await r.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {}
      if (!r.ok || data?.ok === false || !data?.user) throw new Error(data?.message || "Sign in failed");
      const user: AuthUser = data.user;
      localStorage.setItem("aw.auth", JSON.stringify(user));
      try { window.dispatchEvent(new Event("aw-auth-changed")); } catch {}
      onSignedIn(user);
      toast.success("Signed in");
    } catch (err) {
      toast.error(friendlyError(err, "Couldn’t sign you in. Check your details and try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="signin-identifier">Email or Username</Label>
          <Input id="signin-identifier" name="identifier" ref={identRef} type="text" autoComplete="username" placeholder="you@domain.com or your handle" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="signin-password">Password</Label>
            <Button
              type="button"
              variant="link"
              className="px-0 text-xs text-foreground/70 hover:text-foreground"
              disabled={fpLoading}
              onClick={async () => {
                const identifier = String(identRef.current?.value || "").trim();
                if (!identifier) { toast.error("Please enter your username or email."); return; }
                setFpVerifiedCode(null);
                setFpStep("otp");
                setFpLoading(true);
                try {
                  const r = await apiFetch("/api/auth/forgot/init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier }) });
                  const raw = await r.text();
                  let data: any = {}; try { data = raw ? JSON.parse(raw) : {}; } catch {}
                  if (!r.ok || data?.ok === false) {
                    const msg = data?.message || (identifier.includes("@") ? "No email found." : "No username found.");
                    throw new Error(msg);
                  }
                  toast.success("OTP sent to your email");
                  setFpOpen(true);
                } catch (err) {
                  toast.error(friendlyError(err, "We couldn’t find that account. Please check and try again."));
                } finally {
                  setFpLoading(false);
                }
              }}
            >
              Forgot password?
            </Button>
          </div>
          <Input id="signin-password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in…" : "Continue"}</Button>
      </form>

      <Dialog open={fpOpen} onOpenChange={(open) => { setFpOpen(open); if (!open) { setFpStep("otp"); setFpVerifiedCode(null); if (otpRef.current) otpRef.current.value = ""; if (newPassRef.current) newPassRef.current.value = ""; if (confirmPassRef.current) confirmPassRef.current.value = ""; } }}>
        <DialogContent titleText={fpStep === "otp" ? "Verify OTP" : "Reset Password"}>
          <DialogHeader>
            <DialogTitle>{fpStep === "otp" ? "OTP Verification" : "Set a new password"}</DialogTitle>
            <DialogDescription>
              {fpStep === "otp" ? "Enter the 6-digit code sent to your email." : "Choose a strong password and confirm it."}
            </DialogDescription>
          </DialogHeader>

          {fpStep === "otp" ? (
            <div className="space-y-3">
              <Label htmlFor="fp-otp">Enter OTP</Label>
              <Input id="fp-otp" ref={otpRef} inputMode="numeric" pattern="\\d*" placeholder="6-digit code" />
              <Button
                className="w-full"
                disabled={fpLoading}
                onClick={async () => {
                  const identifier = String(identRef.current?.value || "").trim();
                  const code = String(otpRef.current?.value || "").trim();
                  if (!code) return;
                  setFpLoading(true);
                  try {
                    const r = await apiFetch("/api/auth/forgot/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, code }) });
                    const raw = await r.text();
                    let data: any = {}; try { data = raw ? JSON.parse(raw) : {}; } catch {}
                    if (!r.ok || data?.ok === false) throw new Error(data?.message || "Invalid or expired OTP.");
                    toast.success("OTP verified");
                    setFpVerifiedCode(code);
                    setFpStep("reset");
                  } catch (err) {
                    toast.error(friendlyError(err, "That code looks wrong or expired. Please request a new one."));
                  } finally {
                    setFpLoading(false);
                  }
                }}
              >
                {fpLoading ? "Verifying…" : "Verify"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fp-new">New Password</Label>
                <Input id="fp-new" ref={newPassRef} type="password" autoComplete="new-password" placeholder="Create a strong password" />
              </div>
              <Button
                className="w-full"
                disabled={fpLoading}
                onClick={async () => {
                  const identifier = String(identRef.current?.value || "").trim();
                  const code = String(fpVerifiedCode || "").trim();
                  const newPassword = String(newPassRef.current?.value || "").trim();
                  if (!code) { toast.error("Please verify OTP first."); return; }
                  if (!newPassword) return;
                  if (newPassword.length < 6) { toast.error("Password must be at least 6 characters."); return; }
                  setFpLoading(true);
                  try {
                    const r = await apiFetch("/api/auth/forgot/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, code, newPassword }) });
                    const raw = await r.text();
                    let data: any = {}; try { data = raw ? JSON.parse(raw) : {}; } catch {}
                    if (!r.ok || data?.ok === false) throw new Error(data?.message || "Failed to reset password");
                    toast.success("Password changed successfully.");
                    setFpOpen(false);
                  } catch (err) {
                    toast.error(friendlyError(err, "Couldn’t reset password. Please try again."));
                  } finally {
                    setFpLoading(false);
                  }
                }}
              >
                {fpLoading ? "Updating…" : "Update Password"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SignUpForm({ onCompleted }: { onCompleted?: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [otpOpen, setOtpOpen] = React.useState(false);
  const codeRef = React.useRef<HTMLInputElement>(null);

  async function handleVerify() {
    const code = String(codeRef.current?.value || "").trim();
    if (!code) return;
    setLoading(true);
    try {
      const r = await apiFetch("/api/auth/signup/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
      const raw = await r.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {}
      if (!r.ok || data?.ok === false) throw new Error(data?.message || "Verification failed");
      toast.success("Account verified. You can sign in now.");
      setOtpOpen(false);
      onCompleted?.();
    } catch (err) {
      toast.error(friendlyError(err, "Verification failed. Check the code and try again."));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      username: String(fd.get("username") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      password: String(fd.get("password") || ""),
    };
    if (!payload.username || !payload.email || !payload.password) return;
    setLoading(true);
    try {
      const r = await apiFetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const raw = await r.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {}
      if (!r.ok || data?.ok === false) throw new Error(data?.message || "Failed to send OTP");
      setEmail(payload.email);
      setOtpOpen(true);
      toast.success("OTP sent to your email");
    } catch (err) {
      toast.error(friendlyError(err, "Couldn’t send the code. Please try again."));
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="signup-username">Pen Name</Label>
          <Input id="signup-username" name="username" type="text" autoComplete="username" placeholder="your-pen-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input id="signup-email" name="email" type="email" autoComplete="email" placeholder="you@domain.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input id="signup-password" name="password" type="password" autoComplete="new-password" placeholder="Create a strong password" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending OTP…" : "Create account"}</Button>
      </form>

      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent titleText="Verify your email">
          <DialogHeader>
            <DialogTitle>Verify your email</DialogTitle>
            <DialogDescription>Enter the 6-digit code we sent to {email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="signup-code">Enter OTP</Label>
            <Input id="signup-code" ref={codeRef} type="text" inputMode="numeric" pattern="\\d*" placeholder="6-digit code" />
          </div>
          <DialogFooter>
            <Button onClick={handleVerify} disabled={loading} className="w-full">{loading ? "Verifying…" : "Verify"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccountPanel({ user, onSignOff }: { user: AuthUser; onSignOff: () => void }) {
  const [loading, setLoading] = React.useState(false);
  async function onChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const currentPassword = String(fd.get("currentPassword") || "");
    const newPassword = String(fd.get("newPassword") || "");
    if (!currentPassword || !newPassword) return;
    setLoading(true);
    try {
      const identifier = user.email || user.username;
      const r = await apiFetch("/api/auth/password/change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, currentPassword, newPassword }) });
      const raw = await r.text();
      let data: any = {}; try { data = raw ? JSON.parse(raw) : {}; } catch {}
      if (!r.ok || data?.ok === false) throw new Error(data?.message || "Failed to update password");
      toast.success("Password updated");
      formEl.reset();
    } catch (err) {
      toast.error(friendlyError(err, "Couldn’t update password. Check your current password and try again."));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-4 border border-white/20 dark:border-white/10 bg-white/50 dark:bg-white/5">
        <div className="font-semibold">Signed in</div>
        <div className="mt-1 text-sm text-muted-foreground">Welcome back, {user.username}.</div>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
          <div><span className="text-muted-foreground">Email:</span> {user.email}</div>
          <div><span className="text-muted-foreground">Pen Name:</span> {user.username}</div>
        </div>
      </div>
      <div className="rounded-2xl p-4 border border-white/20 dark:border-white/10 bg-white/50 dark:bg-white/5">
        <div className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" /> Change Password</div>
        <form className="mt-3 space-y-3" onSubmit={onChangePassword}>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" placeholder="Choose a strong password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Updating…" : "Update Password"}</Button>
        </form>
      </div>
    </div>
  );
}

export default function JoinUs() {
  const [mode, setMode] = React.useState<"signin" | "signup">("signup");
  const [user, setUser] = React.useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem("aw.auth") || "null"); } catch { return null; }
  });
  const handleSignedIn = (u: AuthUser) => setUser(u);
  const handleSignOff = () => { apiFetch("/api/auth/signout", { method: "POST" }).catch(() => {}); localStorage.removeItem("aw.auth"); try { window.dispatchEvent(new Event("aw-auth-changed")); } catch {} setUser(null); };

  return (
    <main className="container py-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
      <div className="mx-auto max-w-5xl grid gap-6 md:grid-cols-2 items-center min-h-[50vh]">
        <section className="rounded-3xl p-8 md:p-10 glass-soft">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight gradient-text">Join Us</h1>
          <p className="mt-2 max-w-xl text-sm md:text-base text-muted-foreground">Become part of our community. Get early features, share feedback, and help shape the future of AngelWrites.</p>

          {user && (
            <div className="mt-6">
              <Button onClick={handleSignOff} variant="secondary" className="gap-2"><LogOut className="h-4 w-4" /> Sign Off</Button>
            </div>
          )}

          {!user && (
            <div className="mt-6">
              <ToggleGroup
                className="inline-flex rounded-full glass p-1 gap-1 ring-1 ring-white/25 dark:ring-white/10"
                type="single"
                value={mode}
                onValueChange={(v) => v && setMode(v as typeof mode)}
                size="sm"
                aria-label="Choose how you want to proceed"
              >
                <ToggleGroupItem
                  value="signup"
                  aria-label="Start Writing"
                  className="rounded-full h-9 px-4 md:h-10 md:px-5 font-medium text-foreground/90 hover:bg-white/40 dark:hover:bg-white/10 hover:text-foreground border border-transparent data-[state=on]:shadow-md data-[state=on]:ring-1 data-[state=on]:ring-white/30"
                >
                  <PenLine className="mr-2 h-4 w-4" /> Start Writing
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="signin"
                  aria-label="Continue Writing"
                  className="rounded-full h-9 px-4 md:h-10 md:px-5 font-medium text-foreground/90 hover:bg-white/40 dark:hover:bg-white/10 hover:text-foreground border border-transparent data-[state=on]:shadow-md data-[state=on]:ring-1 data-[state=on]:ring-white/30"
                >
                  <LogIn className="mr-2 h-4 w-4" /> Continue Writing
                </ToggleGroupItem>
              </ToggleGroup>

              <p className="mt-3 text-xs text-muted-foreground">
                {mode === "signin" ? "Returning author? Pick up where you left off." : "New to AngelWrites? Create your space and begin."}
              </p>
            </div>
          )}
        </section>

        <div className="w-full max-w-md mx-auto md:ml-auto rounded-3xl glass p-6 md:p-8">
          {user ? (
            <AccountPanel user={user} onSignOff={handleSignOff} />
          ) : (
            mode === "signin" ? <SignInForm onSignedIn={handleSignedIn} /> : <SignUpForm onCompleted={() => setMode("signin")} />
          )}
        </div>
      </div>
    </main>
  );
}
