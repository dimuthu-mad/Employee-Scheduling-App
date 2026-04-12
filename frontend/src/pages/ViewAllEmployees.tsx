import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthSession } from "../auth";
import hotelLogo from "../assets/HotellLogo.png";

type EmployeeRow = {
  employeeId: number;
  firstName: string;
  lastName: string;
  position: string;
  user?: {
    email: string;
  };
};

const API_URL = "http://localhost:3000";

export function ViewAllEmployees() {
  const navigate = useNavigate();
  const session = getAuthSession();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(`${API_URL}/employees`);
        if (!response.ok) {
          throw new Error("Failed to load employees");
        }

        const data = (await response.json()) as EmployeeRow[];
        setEmployees(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load employees",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadEmployees();
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login", { replace: true });
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
          <button type="button" className="register-employee-btn">
            Register new Employee
          </button>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="employees-card">
        <h1 className="employees-title">List of all Employees</h1>
        <p className="employees-meta">Employer ID: {session?.userId ?? "-"}</p>

        {isLoading ? <p>Loading employees...</p> : null}

        {!isLoading && errorMessage ? (
          <p className="employees-error">{errorMessage}</p>
        ) : null}

        {!isLoading && !errorMessage ? (
          <div className="employee-grid">
            {employees.length === 0 ? (
              <p>No employees found.</p>
            ) : (
              employees.map((employee) => (
                <article className="employee-card" key={employee.employeeId}>
                  <div className="employee-avatar" aria-hidden="true">
                    <span>●</span>
                  </div>
                  <h3>{`${employee.firstName} ${employee.lastName}`}</h3>
                  <p>{employee.user?.email ?? "-"}</p>
                  <p className="employee-role">
                    {employee.position.replaceAll("_", " ")}
                  </p>
                  <div className="employee-actions">
                    <button type="button" className="employee-edit-btn">
                      Edit
                    </button>
                    <button type="button" className="employee-delete-btn">
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
