import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthSession } from "../auth";
import hotelLogo from "../assets/HotellLogo.png";
import userLogo from "../assets/user.png";

type EmployeePosition = "HEAD_WAITER" | "WAITER" | "RUNNER";

type EmployeeFormData = {
  firstName: string;
  lastName: string;
  email: string;
  loginCode: string;
  position: EmployeePosition;
};

type EmployeeRow = {
  employeeId: number;
  firstName: string;
  lastName: string;
  position: string;
  loginCode: string;
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState<EmployeeFormData>({
    firstName: "",
    lastName: "",
    email: "",
    loginCode: "",
    position: "WAITER",
  });
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<number | null>(
    null,
  );
  const [pendingDeleteEmployee, setPendingDeleteEmployee] =
    useState<EmployeeRow | null>(null);

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

  useEffect(() => {
    void loadEmployees();
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login", { replace: true });
  };

  const handleEditClick = (employee: EmployeeRow) => {
    setSelectedEmployee(employee);
    setEditFormData({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.user?.email ?? "",
      loginCode: employee.loginCode,
      position:
        employee.position === "HEAD_WAITER" ||
        employee.position === "WAITER" ||
        employee.position === "RUNNER"
          ? employee.position
          : "WAITER",
    });
    setEditError("");
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setSelectedEmployee(null);
    setEditFormData({
      firstName: "",
      lastName: "",
      email: "",
      loginCode: "",
      position: "WAITER",
    });
    setEditError("");
  };

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedEmployee) {
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError("");

      const response = await fetch(
        `${API_URL}/employees/${selectedEmployee.employeeId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstName: editFormData.firstName.trim(),
            lastName: editFormData.lastName.trim(),
            email: editFormData.email.trim(),
            loginCode: editFormData.loginCode.trim(),
            position: editFormData.position,
          }),
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to update employee");
      }

      await loadEmployees();
      handleCloseModal();
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openDeleteModal = (employee: EmployeeRow) => {
    setPendingDeleteEmployee(employee);
  };

  const closeDeleteModal = () => {
    if (deletingEmployeeId !== null) {
      return;
    }

    setPendingDeleteEmployee(null);
  };

  const handleDeleteEmployee = async () => {
    if (!pendingDeleteEmployee) {
      return;
    }

    try {
      setDeletingEmployeeId(pendingDeleteEmployee.employeeId);
      setErrorMessage("");

      const response = await fetch(
        `${API_URL}/employees/${pendingDeleteEmployee.employeeId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to delete employee");
      }

      await loadEmployees();
      if (selectedEmployee?.employeeId === pendingDeleteEmployee.employeeId) {
        handleCloseModal();
      }
      setPendingDeleteEmployee(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not delete employee",
      );
    } finally {
      setDeletingEmployeeId(null);
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
            onClick={() => navigate("/employees/new")}
          >
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
                    <img
                      src={userLogo}
                      alt="Employee avatar"
                      className="Employee-avatar"
                    />
                  </div>
                  <h3>{`${employee.firstName} ${employee.lastName}`}</h3>
                  <p>{employee.user?.email ?? "-"}</p>
                  <p className="employee-role">
                    {employee.position.replaceAll("_", " ")}
                  </p>
                  <p>{`${employee.loginCode}`}</p>
                  <div className="employee-actions">
                    <button
                      type="button"
                      className="employee-edit-btn"
                      onClick={() => handleEditClick(employee)}
                      disabled={deletingEmployeeId === employee.employeeId}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="employee-delete-btn"
                      onClick={() => openDeleteModal(employee)}
                      disabled={deletingEmployeeId === employee.employeeId}
                    >
                      {deletingEmployeeId === employee.employeeId
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : null}
      </section>

      {isEditModalOpen && selectedEmployee ? (
        <div className="edit-modal-overlay" onClick={handleCloseModal}>
          <div
            className="edit-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="edit-modal-header">
              <div>
                <p className="edit-modal-kicker">Edit employee</p>
                <h2>
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </h2>
              </div>
              <button
                type="button"
                className="edit-modal-close"
                onClick={handleCloseModal}
                aria-label="Close edit form"
              >
                ×
              </button>
            </div>

            <form className="edit-form" onSubmit={handleSaveEdit}>
              <div className="edit-form-grid">
                <label className="edit-field">
                  <span>First name</span>
                  <input
                    type="text"
                    value={editFormData.firstName}
                    onChange={(event) =>
                      setEditFormData((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="edit-field">
                  <span>Last name</span>
                  <input
                    type="text"
                    value={editFormData.lastName}
                    onChange={(event) =>
                      setEditFormData((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="edit-field edit-field-wide">
                  <span>Email</span>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(event) =>
                      setEditFormData((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="edit-field">
                  <span>Login code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={editFormData.loginCode}
                    onChange={(event) =>
                      setEditFormData((current) => ({
                        ...current,
                        loginCode: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="edit-field">
                  <span>Position</span>
                  <select
                    value={editFormData.position}
                    onChange={(event) =>
                      setEditFormData((current) => ({
                        ...current,
                        position: event.target.value as EmployeePosition,
                      }))
                    }
                  >
                    <option value="HEAD_WAITER">Head Waiter</option>
                    <option value="WAITER">Waiter</option>
                    <option value="RUNNER">Runner</option>
                  </select>
                </label>
              </div>

              {editError ? <p className="edit-error">{editError}</p> : null}

              <div className="edit-form-actions">
                <button
                  type="button"
                  className="edit-cancel-btn"
                  onClick={handleCloseModal}
                  disabled={isSavingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="edit-save-btn"
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pendingDeleteEmployee ? (
        <div className="edit-modal-overlay" onClick={closeDeleteModal}>
          <div
            className="edit-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="edit-modal-header">
              <div>
                <p className="edit-modal-kicker">Confirm delete</p>
                <h2>
                  Delete {pendingDeleteEmployee.firstName}{" "}
                  {pendingDeleteEmployee.lastName}?
                </h2>
              </div>
              <button
                type="button"
                className="edit-modal-close"
                onClick={closeDeleteModal}
                aria-label="Close delete confirmation"
                disabled={
                  deletingEmployeeId === pendingDeleteEmployee.employeeId
                }
              >
                ×
              </button>
            </div>

            <p className="employees-error">This cannot be undone.</p>

            <div className="edit-form-actions">
              <button
                type="button"
                className="edit-cancel-btn"
                onClick={closeDeleteModal}
                disabled={
                  deletingEmployeeId === pendingDeleteEmployee.employeeId
                }
              >
                Cancel
              </button>
              <button
                type="button"
                className="employee-delete-btn"
                onClick={handleDeleteEmployee}
                disabled={
                  deletingEmployeeId === pendingDeleteEmployee.employeeId
                }
              >
                {deletingEmployeeId === pendingDeleteEmployee.employeeId
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
