import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession } from "../auth";
import hotelLogo from "../assets/HotellLogo.png";

type EmployeePosition = "HEAD_WAITER" | "WAITER" | "RUNNER";

type CreateEmployeeResponse = {
  error?: string;
};

const API_URL = "https://employee-scheduling-app-server.vercel.app";

export function RegisterEmployeePage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [position, setPosition] = useState<EmployeePosition>("WAITER");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login", { replace: true });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const response = await fetch(`${API_URL}/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          loginCode: loginCode.trim(),
          position,
        }),
      });

      const data = (await response.json()) as CreateEmployeeResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to create employee");
      }

      navigate("/employees", { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create employee",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="employees-shell">
      <header className="employees-header">
        <img
          className="employees-logo"
          src={hotelLogo}
          alt="Sundsgarden Hotel"
        />
        <div className="employees-header-actions">
          <button
            type="button"
            className="register-employee-btn"
            onClick={() => navigate("/work-schedule")}
          >
            Work Schedule
          </button>
          <button
            type="button"
            className="register-employee-btn"
            onClick={() => navigate("/schedule")}
          >
            Job Schedule
          </button>
          <button
            type="button"
            className="register-employee-btn"
            onClick={() => navigate("/employees")}
            disabled={isSubmitting}
          >
            Employee List
          </button>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="employees-card" aria-label="Register employee form">
        <h1 className="employees-title">Register New Employee</h1>
        <p className="employees-meta">Create a new account for an employee.</p>

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="edit-form-grid">
            <label className="edit-field">
              <span>First name</span>
              <input
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
            </label>

            <label className="edit-field">
              <span>Last name</span>
              <input
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </label>

            <label className="edit-field edit-field-wide">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="edit-field">
              <span>Login code</span>
              <input
                type="password"
                value={loginCode}
                onChange={(event) => setLoginCode(event.target.value)}
                minLength={4}
                maxLength={4}
                required
              />
            </label>

            <label className="edit-field">
              <span>Position</span>
              <select
                value={position}
                onChange={(event) =>
                  setPosition(event.target.value as EmployeePosition)
                }
              >
                <option value="HEAD_WAITER">Head Waiter</option>
                <option value="WAITER">Waiter</option>
                <option value="RUNNER">Runner</option>
              </select>
            </label>
          </div>

          {errorMessage ? <p className="edit-error">{errorMessage}</p> : null}

          <div className="edit-form-actions">
            <button
              type="button"
              className="edit-cancel-btn"
              onClick={() => navigate("/employees")}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="edit-save-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
