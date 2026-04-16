import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthSession } from "../auth";
import hotelLogo from "../assets/HotellLogo.png";

type ShiftType = "MORNING" | "AFTERNOON" | "EVENING";

type EmployeeProfile = {
  employeeId: number;
  firstName: string;
  lastName: string;
};

type EmployeeScheduleEntry = {
  scheduleEntryId: number;
  date: string;
  isApproved: boolean;
  employee: EmployeeProfile;
  shift: {
    shiftId: number;
    shiftType: ShiftType;
  };
  availabilityStatus: string;
};

type DayCell = {
  key: string;
  label: string;
  date: Date;
};

type WeekOption = {
  label: string;
  days: DayCell[];
};

const API_URL = "http://localhost:3000";

const SHIFT_ROWS: Array<{ shift: ShiftType; label: string; hours: string }> = [
  { shift: "MORNING", label: "Morning shift", hours: "7-15" },
  { shift: "AFTERNOON", label: "Afternoon shift", hours: "15-18" },
  { shift: "EVENING", label: "Night shift", hours: "18-23" },
];

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

function formatMonthRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  const endMonth = end.toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getUTCDate()}-${end.getUTCDate()}`;
  }

  return `${startMonth} ${start.getUTCDate()} - ${endMonth} ${end.getUTCDate()}`;
}

export function EmployeeSchedulePage() {
  const navigate = useNavigate();
  const session = getAuthSession();
  const employeeId = session?.employeeId ?? null;

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [scheduleEntries, setScheduleEntries] = useState<
    EmployeeScheduleEntry[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState<number | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!employeeId) {
          throw new Error("Missing employee session");
        }

        setIsLoading(true);
        setErrorMessage("");

        const profileResponse = await fetch(
          `${API_URL}/employees/${employeeId}`,
        );
        const profileData = (await profileResponse.json()) as
          | EmployeeProfile
          | { error?: string };

        if (!profileResponse.ok || !("employeeId" in profileData)) {
          const apiError =
            !("employeeId" in profileData) && "error" in profileData
              ? profileData.error
              : undefined;
          throw new Error(apiError || "Failed to load employee profile");
        }

        setProfile(profileData);

        const scheduleResponse = await fetch(
          `${API_URL}/schedule-with-availability/${employeeId}`,
        );
        const scheduleData = (await scheduleResponse.json()) as
          | EmployeeScheduleEntry[]
          | { error?: string };

        if (!scheduleResponse.ok || !Array.isArray(scheduleData)) {
          const apiError =
            !Array.isArray(scheduleData) && "error" in scheduleData
              ? scheduleData.error
              : undefined;
          throw new Error(apiError || "Failed to load schedule");
        }

        setScheduleEntries(scheduleData);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load schedule",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [employeeId]);

  const weekDays = useMemo<DayCell[]>(() => {
    const weekStart = startOfWeekMonday(new Date());

    return Array.from({ length: 14 }, (_, index) => {
      const date = addDays(weekStart, index);
      return {
        date,
        key: toDateKey(date),
        label: formatDayLabel(date),
      };
    });
  }, []);

  const weeks = useMemo<WeekOption[]>(() => {
    return [
      { label: "Week 1", days: weekDays.slice(0, 7) },
      { label: "Week 2", days: weekDays.slice(7, 14) },
    ];
  }, [weekDays]);

  const selectedWeek = weeks[selectedWeekIndex] ?? weeks[0];

  const selectedRangeLabel = useMemo(() => {
    const firstDay = selectedWeek?.days[0];
    const lastDay = selectedWeek?.days[selectedWeek.days.length - 1];

    if (!firstDay || !lastDay) {
      return "";
    }

    return formatMonthRange(firstDay.date, lastDay.date);
  }, [selectedWeek]);

  const scheduleByDayAndShift = useMemo(() => {
    const grouped = new Map<string, EmployeeScheduleEntry>();

    for (const entry of scheduleEntries) {
      grouped.set(`${toDateKey(entry.date)}-${entry.shift.shiftType}`, entry);
    }

    return grouped;
  }, [scheduleEntries]);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login", { replace: true });
  };

  const handleConfirm = async (scheduleEntryId: number) => {
    try {
      setIsSaving(scheduleEntryId);

      const response = await fetch(
        `${API_URL}/schedule/${scheduleEntryId}/approve`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ employeeId }),
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to confirm schedule entry");
      }

      const refreshed = await fetch(
        `${API_URL}/schedule-with-availability/${employeeId}`,
      );
      const refreshedData = (await refreshed.json()) as EmployeeScheduleEntry[];

      if (!refreshed.ok || !Array.isArray(refreshedData)) {
        throw new Error("Failed to reload schedule");
      }

      setScheduleEntries(refreshedData);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not confirm schedule",
      );
    } finally {
      setIsSaving(null);
    }
  };

  return (
    <main className="work-schedule-shell employee-schedule-shell">
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
            onClick={() => navigate("/employee")}
          >
            Availability
          </button>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="work-schedule-card employee-schedule-card">
        <div className="work-schedule-titlebar">
          <div>
            <h1>
              {profile
                ? `${profile.firstName}'s Schedule`
                : "Employee Schedule"}
            </h1>
            <p className="employees-meta">Confirm the shifts you can work.</p>
          </div>
        </div>

        <div className="work-schedule-toolbar">
          <button
            type="button"
            className="work-schedule-today-btn"
            onClick={() => setSelectedWeekIndex(0)}
          >
            Today
          </button>

          <label className="work-schedule-week-select">
            <span>Week</span>
            <select
              value={selectedWeekIndex}
              onChange={(event) => {
                setSelectedWeekIndex(Number(event.target.value));
              }}
            >
              {weeks.map((week, index) => (
                <option key={week.label} value={index}>
                  {week.label}
                </option>
              ))}
            </select>
          </label>

          <div className="work-schedule-week-nav">
            <button
              type="button"
              className="work-schedule-week-nav-btn"
              onClick={() =>
                setSelectedWeekIndex((current) => Math.max(0, current - 1))
              }
              disabled={selectedWeekIndex === 0}
              aria-label="Previous week"
            >
              ‹
            </button>
            <div className="work-schedule-week-range">{selectedRangeLabel}</div>
            <button
              type="button"
              className="work-schedule-week-nav-btn"
              onClick={() =>
                setSelectedWeekIndex((current) =>
                  Math.min(weeks.length - 1, current + 1),
                )
              }
              disabled={selectedWeekIndex >= weeks.length - 1}
              aria-label="Next week"
            >
              ›
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="work-schedule-state">Loading schedule...</p>
        ) : null}
        {!isLoading && errorMessage ? (
          <p className="work-schedule-error">{errorMessage}</p>
        ) : null}

        {!isLoading && !errorMessage ? (
          <>
            <div className="employee-schedule-legend">
              Green means confirmed that you can do this shift.
            </div>

            <div className="work-schedule-board-wrap">
              <table className="work-schedule-board-table employee-schedule-board-table">
                <thead>
                  <tr>
                    <th className="work-schedule-employee-column" scope="col">
                      Shift
                    </th>
                    {selectedWeek.days.map((day) => (
                      <th key={day.key} scope="col">
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SHIFT_ROWS.map((row) => (
                    <tr key={row.shift}>
                      <th className="work-schedule-employee-row" scope="row">
                        {row.label}
                      </th>
                      {selectedWeek.days.map((day) => {
                        const entry = scheduleByDayAndShift.get(
                          `${day.key}-${row.shift}`,
                        );

                        return (
                          <td
                            key={`${day.key}-${row.shift}`}
                            className="employee-schedule-cell"
                          >
                            {entry ? (
                              <div
                                className={
                                  entry.isApproved
                                    ? "employee-schedule-entry employee-schedule-entry--approved"
                                    : "employee-schedule-entry employee-schedule-entry--pending"
                                }
                              >
                                {entry.isApproved ? (
                                  <span
                                    className="employee-schedule-tick"
                                    aria-label="Accepted shift"
                                  >
                                    ✓
                                  </span>
                                ) : null}
                                <span className="employee-schedule-hours">
                                  {row.hours}
                                </span>
                                {entry.isApproved ? (
                                  <span className="employee-schedule-status employee-schedule-status--approved">
                                    Confirmed
                                  </span>
                                ) : (
                                  <>
                                    <span className="employee-schedule-status employee-schedule-status--pending">
                                      Pending
                                    </span>
                                    <button
                                      type="button"
                                      className="employee-schedule-confirm-btn"
                                      onClick={() =>
                                        handleConfirm(entry.scheduleEntryId)
                                      }
                                      disabled={
                                        isSaving === entry.scheduleEntryId
                                      }
                                    >
                                      {isSaving === entry.scheduleEntryId
                                        ? "Confirming..."
                                        : "Confirm"}
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="employee-schedule-empty">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
