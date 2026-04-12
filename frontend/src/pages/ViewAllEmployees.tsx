import { useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthSession } from "../auth";

export function ViewAllEmployees() {
  const navigate = useNavigate();
  const session = getAuthSession();
  const handleLogout = () => {
    clearAuthSession();
    navigate("/login", { replace: true });
  };

  return (
    <main style={{ maxWidth: 700, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>All Employees</h1>
      <p>Welcome, employer.</p>
      <p>User ID: {session?.userId ?? "-"}</p>
      <button type="button" onClick={handleLogout}>
        Logout
      </button>
    </main>
  );
}
