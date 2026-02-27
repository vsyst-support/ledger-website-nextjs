import { useState } from "react";
import Head from "next/head";

export default function LoginPage() {
  const [password, setPassword] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.href = "/";
      return;
    }

    alert(await res.text());
  }

  return (
    <>
      <Head>
        <title>Login</title>
      </Head>
      <main style={{ maxWidth: 420, margin: "64px auto", padding: 16 }}>
        <div className="login_container">
          <h2>Login</h2>
          <form onSubmit={onSubmit}>
            <input
              type="password"
              name="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "calc(100% - 12px)",
                marginRight: 12,
                marginBottom: 12,
                padding: 10,
              }}
            />
            <div className="login_actions">
              <button type="submit" className="login_btn">
                Login
              </button>
              <a href="/reset">Reset Password</a>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
