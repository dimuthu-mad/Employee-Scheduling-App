import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession } from "../auth";
import hotelLogo from "../assets/HotellLogo.png";
import userLogo from "../assets/user.png";

type ShiftType = "MORNING" | "AFTERNOON" | "EVENING";
type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "PREFERED";

type EmployeeRow = {
  employeeId: number;
  firstName: string;
  lastName: string;
  position: string;
};

type AvailabilityEntry = {
  availabilityId: number;
  date: string;
  status: AvailabilityStatus;
  shift: {
    shiftId: number;
    shiftType: ShiftType;
  };
};

type ScheduleEntryRow = {
  scheduleEntryId: number;
  date: string;
  isApproved?: boolean;
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

type DayCell = {
  key: string;
  label: string;
  date: Date;
};

type WeekOption = {
  label: string;
  days: DayCell[];
};

type DaySummary = {
  kind: "available" | "unavailable" | "preferred" | "mixed";
  label: string;
  detail?: string;
  preferredShift?: ShiftType;
};

type SelectedCell = {
  employeeId: number;
  dateKey: string;
};

const API_URL = "https://employee-scheduling-app-server.vercel.app";

const SHIFT_ORDER: Record<ShiftType, number> = {
  MORNING: 0,
  AFTERNOON: 1,
  EVENING: 2,
};

const SHIFT_HOURS: Record<ShiftType, string> = {
  MORNING: "7-15",
  AFTERNOON: "15-18",
  EVENING: "18-23",
};

const SHIFT_LABELS: Record<ShiftType, string> = {
  MORNING: "Morning shift",
  AFTERNOON: "Afternoon shift",
  EVENING: "Night shift",
};

const SHIFT_OPTIONS: ShiftType[] = ["MORNING", "AFTERNOON", "EVENING"];

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

function formatWeekRange(start: Date, end: Date): string {
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

function summarize(entries: AvailabilityEntry[]): DaySummary | null {
  if (entries.length === 0) {
    return null;
  }

  const preferred = entries.find((entry) => entry.status === "PREFERED");
  if (preferred) {
    return {
      kind: "preferred",
      label: "Prefers to work",
      detail: SHIFT_HOURS[preferred.shift.shiftType],
      preferredShift: preferred.shift.shiftType,
    };
  }

  if (entries.every((entry) => entry.status === "UNAVAILABLE")) {
    return { kind: "unavailable", label: "Unavailable" };
  }

  if (entries.every((entry) => entry.status === "AVAILABLE")) {
    return { kind: "available", label: "Available" };
  }

  return { kind: "mixed", label: "Mixed" };
}

function getAllowedShiftTypes(entries: AvailabilityEntry[]): ShiftType[] {
  const allowed = entries
    .filter((entry) => entry.status !== "UNAVAILABLE")
    .map((entry) => entry.shift.shiftType);

  return allowed.length > 0 ? allowed : SHIFT_OPTIONS;
}

function formatScheduleStatus(isApproved?: boolean): string {
  return isApproved ? "Approved" : "Pending";
}

export function WorkSchedulePage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [availabilityByEmployee, setAvailabilityByEmployee] = useState<
    Record<number, AvailabilityEntry[]>
  >({});
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntryRow[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [selectedShift, setSelectedShift] = useState<ShiftType>("MORNING");
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const [employeesResponse, scheduleResponse] = await Promise.all([
        fetch(`${API_URL}/employees`),
        fetch(`${API_URL}/schedule`),
      ]);

      if (!employeesResponse.ok) {
        throw new Error("Failed to load employees");
      }

      if (!scheduleResponse.ok) {
        throw new Error("Failed to load schedule");
      }

      const employeesData = (await employeesResponse.json()) as EmployeeRow[];
      const scheduleData =
        (await scheduleResponse.json()) as ScheduleEntryRow[];

      const availabilityPairs = await Promise.all(
        employeesData.map(async (employee) => {
          const response = await fetch(
            `${API_URL}/availability/${employee.employeeId}`,
          );

          if (!response.ok) {
            throw new Error(
              `Failed to load availability for ${employee.firstName} ${employee.lastName}`,
            );
          }

          const data = (await response.json()) as AvailabilityEntry[];
          return [employee.employeeId, data] as const;
        }),
      );

      const nextAvailabilityByEmployee: Record<number, AvailabilityEntry[]> =
        {};
      for (const [employeeId, entries] of availabilityPairs) {
        nextAvailabilityByEmployee[employeeId] = entries;
      }

      setEmployees(employeesData);
      setScheduleEntries(scheduleData);
      setAvailabilityByEmployee(nextAvailabilityByEmployee);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load schedule",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

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

    return formatWeekRange(firstDay.date, lastDay.date);
  }, [selectedWeek]);

  const employeeById = useMemo(() => {
    return new Map(
      employees.map((employee) => [employee.employeeId, employee]),
    );
  }, [employees]);

  const availabilityByEmployeeDay = useMemo(() => {
    const grouped = new Map<string, AvailabilityEntry[]>();

    for (const [employeeId, entries] of Object.entries(
      availabilityByEmployee,
    )) {
      for (const entry of entries) {
        const key = `${employeeId}-${toDateKey(entry.date)}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.push(entry);
        } else {
          grouped.set(key, [entry]);
        }
      }
    }

    return grouped;
  }, [availabilityByEmployee]);

  const scheduleByEmployeeDay = useMemo(() => {
    const grouped = new Map<string, ScheduleEntryRow[]>();

    for (const entry of scheduleEntries) {
      const key = `${entry.employee.employeeId}-${toDateKey(entry.date)}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        grouped.set(key, [entry]);
      }
    }

    return grouped;
  }, [scheduleEntries]);

  const shiftIdByType = useMemo(() => {
    const map = new Map<ShiftType, number>();

    for (const entries of Object.values(availabilityByEmployee)) {
      for (const entry of entries) {
        map.set(entry.shift.shiftType, entry.shift.shiftId);
      }
    }

    for (const entry of scheduleEntries) {
      map.set(entry.shift.shiftType, entry.shift.shiftId);
    }

    return map;
  }, [availabilityByEmployee, scheduleEntries]);

  const scheduleEntriesForWeek = useMemo(() => {
    const weekKeys = new Set(selectedWeek.days.map((day) => day.key));

    return [...scheduleEntries]
      .filter((entry) => weekKeys.has(toDateKey(entry.date)))
      .sort((left, right) => {
        const leftDate = toDateKey(left.date);
        const rightDate = toDateKey(right.date);

        if (leftDate !== rightDate) {
          return leftDate.localeCompare(rightDate);
        }

        const shiftDifference =
          SHIFT_ORDER[left.shift.shiftType] -
          SHIFT_ORDER[right.shift.shiftType];

        if (shiftDifference !== 0) {
          return shiftDifference;
        }

        return `${left.employee.firstName} ${left.employee.lastName}`.localeCompare(
          `${right.employee.firstName} ${right.employee.lastName}`,
        );
      });
  }, [scheduleEntries, selectedWeek.days]);

  const selectedCellDetails = useMemo(() => {
    if (!selectedCell) {
      return null;
    }

    const employee = employeeById.get(selectedCell.employeeId);
    if (!employee) {
      return null;
    }

    const dayAvailability =
      availabilityByEmployeeDay.get(
        `${selectedCell.employeeId}-${selectedCell.dateKey}`,
      ) ?? [];
    const summary = summarize(dayAvailability);
    const allowedShifts = getAllowedShiftTypes(dayAvailability);
    const scheduledEntries =
      scheduleByEmployeeDay.get(
        `${selectedCell.employeeId}-${selectedCell.dateKey}`,
      ) ?? [];

    return {
      employee,
      dateKey: selectedCell.dateKey,
      summary,
      allowedShifts,
      scheduledEntries,
      dayLabel:
        selectedWeek.days.find((day) => day.key === selectedCell.dateKey)
          ?.label ?? selectedCell.dateKey,
    };
  }, [
    availabilityByEmployeeDay,
    employeeById,
    selectedCell,
    scheduleByEmployeeDay,
    selectedWeek.days,
  ]);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login", { replace: true });
  };

  const handleToday = () => {
    setSelectedWeekIndex(0);
  };

  const handleOpenCell = (employeeId: number, dateKey: string) => {
    const dayAvailability =
      availabilityByEmployeeDay.get(`${employeeId}-${dateKey}`) ?? [];
    const summary = summarize(dayAvailability);
    const allowedShifts = getAllowedShiftTypes(dayAvailability);
    const scheduledEntries =
      scheduleByEmployeeDay.get(`${employeeId}-${dateKey}`) ?? [];

    if (
      !summary ||
      summary.kind === "unavailable" ||
      scheduledEntries.length > 0
    ) {
      return;
    }

    setSelectedShift(summary.preferredShift ?? allowedShifts[0] ?? "MORNING");
    setSelectedCell({ employeeId, dateKey });
  };

  const closeModal = () => {
    if (isSaving) {
      return;
    }

    setSelectedCell(null);
    setSelectedShift("MORNING");
  };

  const handleAssignSchedule = async () => {
    if (!selectedCellDetails) {
      return;
    }

    const shiftId = shiftIdByType.get(selectedShift);
    if (!shiftId) {
      setErrorMessage("Shift data is not ready yet.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");

      const response = await fetch(`${API_URL}/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: selectedCellDetails.employee.employeeId,
          shiftId,
          date: selectedCellDetails.dateKey,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to create schedule entry");
      }

      await loadData();
      closeModal();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not create schedule entry",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="work-schedule-shell">
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
            Employee List
          </button>
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

      <section className="work-schedule-card">
        <div className="work-schedule-titlebar">
          <h1>Work Schedule</h1>
          <button
            type="button"
            className="work-schedule-today-btn"
            onClick={handleToday}
          >
            Today
          </button>
        </div>

        <div className="work-schedule-toolbar">
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
            <div className="work-schedule-board-wrap">
              <table className="work-schedule-board-table">
                <thead>
                  <tr>
                    <th className="work-schedule-employee-column" scope="col">
                      Employee
                    </th>
                    {selectedWeek.days.map((day) => (
                      <th key={day.key} scope="col">
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.employeeId}>
                      <th className="work-schedule-employee-row" scope="row">
                        <div className="work-schedule-employee">
                          <div
                            className="work-schedule-avatar"
                            aria-hidden="true"
                          >
                            <img
                              src={userLogo}
                              alt=""
                              className="work-schedule-avatar-image"
                            />
                          </div>
                          <div>
                            <strong>{`${employee.firstName} ${employee.lastName}`}</strong>
                            <span>
                              {employee.position.replaceAll("_", " ")}
                            </span>
                          </div>
                        </div>
                      </th>

                      {selectedWeek.days.map((day) => {
                        const dayAvailability =
                          availabilityByEmployeeDay.get(
                            `${employee.employeeId}-${day.key}`,
                          ) ?? [];
                        const summary = summarize(dayAvailability);
                        const scheduledEntries =
                          scheduleByEmployeeDay.get(
                            `${employee.employeeId}-${day.key}`,
                          ) ?? [];
                        const canAssign =
                          scheduledEntries.length === 0 &&
                          summary !== null &&
                          summary.kind !== "unavailable";

                        return (
                          <td
                            key={`${employee.employeeId}-${day.key}`}
                            className="work-schedule-cell"
                          >
                            <button
                              type="button"
                              className={`work-schedule-cell-button work-schedule-cell-button--${
                                scheduledEntries.length > 0
                                  ? "scheduled"
                                  : (summary?.kind ?? "empty")
                              }`}
                              onClick={() =>
                                handleOpenCell(employee.employeeId, day.key)
                              }
                              disabled={!canAssign}
                            >
                              {scheduledEntries.length > 0 ? (
                                <div className="work-schedule-chip-stack">
                                  {scheduledEntries.map((entry) => (
                                    <span
                                      key={entry.scheduleEntryId}
                                      className="work-schedule-chip work-schedule-chip--scheduled"
                                    >
                                      <strong>
                                        {SHIFT_HOURS[entry.shift.shiftType]}
                                      </strong>
                                      <span>
                                        {SHIFT_LABELS[entry.shift.shiftType]}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              ) : summary ? (
                                <span
                                  className={`work-schedule-chip work-schedule-chip--${summary.kind}${
                                    summary.kind === "preferred" &&
                                    summary.preferredShift
                                      ? ` work-schedule-chip--preferred-${summary.preferredShift.toLowerCase()}`
                                      : ""
                                  }`}
                                >
                                  <strong>{summary.label}</strong>
                                  {summary.detail ? (
                                    <span>{summary.detail}</span>
                                  ) : null}
                                </span>
                              ) : (
                                <span className="work-schedule-cell-empty">
                                  No response
                                </span>
                              )}

                              {canAssign ? (
                                <span className="work-schedule-cell-action">
                                  Assign shift
                                </span>
                              ) : scheduledEntries.length > 0 ? (
                                <span className="work-schedule-cell-action">
                                  Scheduled
                                </span>
                              ) : summary?.kind === "unavailable" ? (
                                <span className="work-schedule-cell-action">
                                  Unavailable
                                </span>
                              ) : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <section
              className="work-schedule-entry-section"
              aria-label="Scheduled entries"
            >
              <div className="work-schedule-entry-header">
                <div>
                  <h2>Schedule Status</h2>
                  <p>
                    Assignments you create here will appear in the roster below.
                  </p>
                </div>
                <span className="work-schedule-entry-count">
                  {scheduleEntriesForWeek.length} entries
                </span>
              </div>

              <div className="work-schedule-entry-table-wrap">
                <table className="work-schedule-entry-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Employee</th>
                      <th scope="col">Shift</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleEntriesForWeek.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="work-schedule-entry-empty">
                          No schedule entries yet for this week.
                        </td>
                      </tr>
                    ) : (
                      scheduleEntriesForWeek.map((entry) => (
                        <tr key={entry.scheduleEntryId}>
                          <td>{formatDayLabel(new Date(entry.date))}</td>
                          <td>{`${entry.employee.firstName} ${entry.employee.lastName}`}</td>
                          <td>
                            {SHIFT_LABELS[entry.shift.shiftType]} (
                            {SHIFT_HOURS[entry.shift.shiftType]})
                          </td>
                          <td>
                            <span className="work-schedule-status-pill">
                              {formatScheduleStatus(entry.isApproved)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </section>

      {selectedCellDetails ? (
        <div className="work-schedule-modal-overlay" onClick={closeModal}>
          <div
            className="work-schedule-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="work-schedule-modal-header">
              <div>
                <p className="work-schedule-modal-kicker">Assign employee</p>
                <h2>
                  {selectedCellDetails.employee.firstName}{" "}
                  {selectedCellDetails.employee.lastName}
                </h2>
              </div>
              <button
                type="button"
                className="work-schedule-modal-close"
                onClick={closeModal}
                aria-label="Close assign form"
              >
                ×
              </button>
            </div>

            <p className="work-schedule-modal-meta">
              {selectedCellDetails.dayLabel}
              {selectedCellDetails.summary?.kind === "preferred" &&
              selectedCellDetails.summary.detail
                ? ` · prefers ${selectedCellDetails.summary.detail}`
                : ""}
            </p>

            <div className="work-schedule-shift-row">
              {SHIFT_OPTIONS.map((shift) => (
                <button
                  key={shift}
                  type="button"
                  className={
                    selectedShift === shift
                      ? "work-schedule-mode-btn is-active"
                      : "work-schedule-mode-btn"
                  }
                  disabled={!selectedCellDetails.allowedShifts.includes(shift)}
                  onClick={() => setSelectedShift(shift)}
                >
                  {SHIFT_LABELS[shift]}
                </button>
              ))}
            </div>

            <p className="work-schedule-modal-note">
              Availability for this day:{" "}
              {selectedCellDetails.summary?.label ?? "No response"}
              {selectedCellDetails.summary?.detail
                ? ` (${selectedCellDetails.summary.detail})`
                : ""}
            </p>

            <div className="work-schedule-modal-actions">
              <button
                type="button"
                className="work-schedule-cancel-btn"
                onClick={closeModal}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="work-schedule-save-btn"
                onClick={handleAssignSchedule}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Create schedule entry"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
