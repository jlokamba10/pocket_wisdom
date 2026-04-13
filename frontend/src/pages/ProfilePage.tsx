import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../state/auth";

export default function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) {
    return null;
  }

  useEffect(() => {
    setFullName(user.full_name);
  }, [user.full_name]);

  const onProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileStatus(null);
    setProfileError(null);
    try {
      await updateProfile(fullName);
      setProfileStatus("Profile updated.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Profile update failed.");
    } finally {
      setSavingProfile(false);
    }
  };

  const onPasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordStatus(null);
    setPasswordError(null);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordStatus("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Password change failed.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <h1>Profile</h1>
        <p>Manage your personal details and credentials.</p>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>Personal Details</h2>
          <form onSubmit={onProfileSubmit} className="form-stack">
            <label>
              Full name
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input type="email" value={user.email} disabled />
            </label>
            {profileError ? <div className="form-error">{profileError}</div> : null}
            {profileStatus ? <div className="form-success">{profileStatus}</div> : null}
            <button className="primary" type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save profile"}
            </button>
          </form>
        </div>

        <div className="panel">
          <h2>Change Password</h2>
          <form onSubmit={onPasswordSubmit} className="form-stack">
            <label>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </label>
            {passwordError ? <div className="form-error">{passwordError}</div> : null}
            {passwordStatus ? <div className="form-success">{passwordStatus}</div> : null}
            <button className="primary" type="submit" disabled={savingPassword}>
              {savingPassword ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
