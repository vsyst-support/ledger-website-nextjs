import { useState } from "react";
import Head from "next/head";

export default function ResetPage() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function onSubmit(e) {
    e.preventDefault();

    const res = await fetch("/reset-password", {
      method: "POST",
      body: new URLSearchParams({ token, newPassword }),
    });

    const message = await res.text();
    alert(message);
    if (res.ok) {
      window.location.href = "/login";
    }
  }

  return (
    <>
      <Head>
        <title>Reset Password</title>
      </Head>
      <main style={{ maxWidth: 420, margin: "64px auto", padding: 16 }}>
        <h2>Reset Password</h2>
        <form onSubmit={onSubmit}>
          <input
            type="text"
            name="token"
            placeholder="Reset Token"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{ width: "100%", marginBottom: 12, padding: 10 }}
          />
          <input
            type="password"
            name="newPassword"
            placeholder="New Password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 12, padding: 10 }}
          />
          <button type="submit">Reset</button>
        </form>
      </main>
    </>
  );
}
