import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthSession, setAuthSession, type UserRole } from "../auth";
import hotelLogo from "../assets/HotellLogo.png";
type LoginResponse = {
  message: string;
  findUser?: {
    userId: number;
    role: UserRole;
    employee?: {
      employeeId: number;
    } | null;
  };
  error?: string;
};

const API_URL = "https://employee-scheduling-app-server.vercel.app/";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      return;
    }

    if (session.role === "EMPLOYER") {
      navigate("/employees", { replace: true });
      return;
    }

    navigate("/employee", { replace: true });
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          loginCode: loginCode.trim(),
        }),
      });
      const data = (await response.json()) as LoginResponse;

      if (!response.ok || !data.findUser) {
        throw new Error(data.error || "Invalid credentials");
      }

      setAuthSession({
        token: `session-${data.findUser.userId}`,
        role: data.findUser.role,
        userId: data.findUser.userId,
        employeeId: data.findUser.employee?.employeeId ?? null,
      });

      if (data.findUser.role === "EMPLOYER") {
        navigate("/employees", { replace: true });
        return;
      }

      navigate("/employee", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <img className="hotel-logo" src={hotelLogo} alt="Logo" />

      <section className="login-card" aria-label="Login form">
        <h1 className="login-subtitle">Welcome to Employee Schedule </h1>
        <h1 className="login-title">Login</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">
            <span>Email</span>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="name@example.com"
            />
          </label>

          <label className="login-label">
            <span>Login code</span>
            <input
              className="login-input"
              type="password"
              value={loginCode}
              onChange={(event) => setLoginCode(event.target.value)}
              required
              minLength={4}
              maxLength={4}
              placeholder="4-digit code"
            />
          </label>

          {errorMessage ? <p className="login-error">{errorMessage}</p> : null}

          <button
            className="login-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
