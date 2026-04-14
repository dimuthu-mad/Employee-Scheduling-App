import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession } from "../auth";
import hotelLogo from "../assets/HotellLogo.png";

type ShiftType = "MORNING" | "AFTERNOON" | "EVENING";

type ScheduleRow = {
  scheduleEntryId: number;
  date: string;
  employee: {
    employeeId: number;
    firstName: string;
    lastName: string;
  };
  shift: {
    shiftId: number;
    shiftType: ShiftType;
  };
};

const SHIFT_ROWS: Array<{ shift: ShiftType; label: string; hours: string }> = [
  { shift: "MORNING", label: "Morning shift", hours: "7-15" },
  { shift: "AFTERNOON", label: "Afternoon shift", hours: "15-18" },
  { shift: "EVENING", label: "Night shift", hours: "18-23" },
];

const CARD_VARIANTS = [
  "job-chip--blue",
  "job-chip--pink",
  "job-chip--green",
  "job-chip--yellow",
  "job-chip--white",
] as const;

const API_URL = "http://localhost:3000";

function toDateKey(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeekMonday(date: Date): Date {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - diff);
  return monday;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDayLabel(date: Date): string {
  const weekday = date.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
  return `${weekday} ${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
}

function chipVariant(employeeId: number): (typeof CARD_VARIANTS)[number] {
  return CARD_VARIANTS[employeeId % CARD_VARIANTS.length];
}

export function JobSchedulePage() {
  const navigate = useNavigate();
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadSchedule = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(`${API_URL}/schedule`);
        if (!response.ok) {
          throw new Error("Failed to load schedule");
        }

        const data = (await response.json()) as ScheduleRow[];
        setScheduleRows(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load schedule",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadSchedule();
  }, []);

  const weekDays = useMemo(() => {
    const anchor =
      scheduleRows.length > 0 ? new Date(scheduleRows[0].date) : new Date();
    const weekStart = startOfWeekMonday(anchor);

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      return {
        date,
        key: toDateKey(date),
        label: formatDayLabel(date),
      };
    });
  }, [scheduleRows]);

  const groupedByShiftDay = useMemo(() => {
    const grouped = new Map<string, ScheduleRow[]>();

    for (const row of scheduleRows) {
      const key = `${row.shift.shiftType}-${toDateKey(row.date)}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(row);
      } else {
        grouped.set(key, [row]);
      }
    }

    return grouped;
  }, [scheduleRows]);

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
          <button
            type="button"
            className="register-employee-btn"
            onClick={() => navigate("/employees")}
          >
            Employees
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
        <h1 className="employees-title">Job Schedule</h1>
        {isLoading ? <p>Loading schedule...</p> : null}
        {!isLoading && errorMessage ? (
          <p className="employees-error">{errorMessage}</p>
        ) : null}

        {!isLoading && !errorMessage ? (
          <div className="job-grid-wrap">
            <table className="job-grid-table">
              <thead>
                <tr>
                  <th className="job-shift-column" scope="col">
                    Shift
                  </th>
                  {weekDays.map((day) => (
                    <th key={day.key} scope="col">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SHIFT_ROWS.map((row) => (
                  <tr key={row.shift}>
                    <th className="job-shift-row" scope="row">
                      {row.label}
                    </th>
                    {weekDays.map((day) => {
                      const key = `${row.shift}-${day.key}`;
                      const assignments = groupedByShiftDay.get(key) ?? [];

                      return (
                        <td key={key} className="job-cell">
                          {assignments.length === 0 ? (
                            <span className="job-available">Available</span>
                          ) : (
                            <div className="job-chip-stack">
                              {assignments.map((assignment) => (
                                <article
                                  key={assignment.scheduleEntryId}
                                  className={`job-chip ${chipVariant(assignment.employee.employeeId)}`}
                                >
                                  <strong>{row.hours}</strong>
                                  <p>
                                    {assignment.employee.firstName}{" "}
                                    {assignment.employee.lastName}
                                  </p>
                                </article>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
