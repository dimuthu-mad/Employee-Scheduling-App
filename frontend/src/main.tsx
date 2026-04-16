import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { JobSchedulePage } from "./pages/JobSchedulePage";
import { WorkSchedulePage } from "./pages/WorkSchedulePage";
import { EmployeeSchedulePage } from "./pages/EmployeeSchedulePage";
import { RegisterEmployeePage } from "./pages/RegisterEmployeePage";
import { ViewAllEmployees } from "./pages/ViewAllEmployees";
import { LoginPage } from "./pages/LoginPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { EmployeeAvailabilityPage } from "./pages/EmployeeAvailabilityPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route
          path="/employees"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYER"]}>
              <ViewAllEmployees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees/new"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYER"]}>
              <RegisterEmployeePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYER"]}>
              <JobSchedulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/work-schedule"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYER"]}>
              <WorkSchedulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
              <EmployeeAvailabilityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee-schedule"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
              <EmployeeSchedulePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
