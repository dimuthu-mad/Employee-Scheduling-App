import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthSession } from "../auth";
import hotelLogo from "../assets/HotellLogo.png";

type ShiftType = "MORNING" | "AFTERNOON" | "EVENING";
type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "PREFERED";

type Shift = {
  shiftId: number;
  shiftType: ShiftType;
};

type EmployeeProfile = {
  employeeId: number;
  firstName: string;
  lastName: string;
};

type AvailabilityEntry = {
  availabilityId: number;
  date: string;
  status: AvailabilityStatus;
  shift: Shift;
};

type EmployeeResponse = EmployeeProfile | { error?: string };
type AvailabilityResponse = AvailabilityEntry[] | { error?: string };

type AvailabilityMode =
  | "AVAILABLE_ALL_DAY"
  | "UNAVAILABLE_ALL_DAY"
  | "PREFERRED";

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

const API_URL = "https://employee-scheduling-app-server.vercel.app";

const SHIFT_ROWS: Array<{ shift: ShiftType; label: string }> = [
  { shift: "MORNING", label: "Morning shift" },
  { shift: "AFTERNOON", label: "Afternoon shift" },
  { shift: "EVENING", label: "Night shift" },
];

const SHIFT_LABELS: Record<ShiftType, string> = {
  MORNING: "Morning Shift",
  AFTERNOON: "Afternoon Shift",
  EVENING: "Evening Shift",
};

const SHIFT_HOURS: Record<ShiftType, string> = {
  MORNING: "7-15",
  AFTERNOON: "15-18",
  EVENING: "18-23",
};

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
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

function formatTitle(name: string): string {
  if (!name) {
    return "Employee Availability";
  }

  return `${name}'s Availability`;
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

export function EmployeeAvailabilityPage() {
  const navigate = useNavigate();
  const session = getAuthSession();
  const employeeId = session?.employeeId ?? null;

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] =
    useState<AvailabilityMode>("AVAILABLE_ALL_DAY");
  const [selectedPreferredShift, setSelectedPreferredShift] =
    useState<ShiftType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
        const profileData = (await profileResponse.json()) as EmployeeResponse;

        if (!profileResponse.ok || !("employeeId" in profileData)) {
          const apiError =
            !("employeeId" in profileData) && "error" in profileData
              ? profileData.error
              : undefined;
          throw new Error(apiError || "Failed to load employee profile");
        }

        setProfile(profileData);

        const availabilityResponse = await fetch(
          `${API_URL}/availability/${employeeId}`,
        );
        const availabilityData =
          (await availabilityResponse.json()) as AvailabilityResponse;

        if (!availabilityResponse.ok || !Array.isArray(availabilityData)) {
          const apiError =
            !Array.isArray(availabilityData) && "error" in availabilityData
              ? availabilityData.error
              : undefined;
          throw new Error(apiError || "Failed to load availability");
        }

        setAvailability(availabilityData);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not load availability",
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

  const availabilityByDateAndShift = useMemo(() => {
    const map = new Map<string, AvailabilityEntry[]>();

    for (const entry of availability) {
      const key = `${toDateKey(entry.date)}-${entry.shift.shiftType}`;
      const existing = map.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(key, [entry]);
      }
    }

    return map;
  }, [availability]);

  const currentDayEntries = useMemo(() => {
    if (!selectedDate) {
      return [] as AvailabilityEntry[];
    }

    return availability.filter(
      (entry) => toDateKey(entry.date) === selectedDate,
    );
  }, [availability, selectedDate]);

  const handlePreviousWeek = () => {
    setSelectedWeekIndex((current) => Math.max(0, current - 1));
  };

  const handleNextWeek = () => {
    setSelectedWeekIndex((current) => Math.min(weeks.length - 1, current + 1));
  };

  const openAvailabilityModal = (dateKey: string) => {
    setSelectedDate(dateKey);

    const entries = availability.filter(
      (entry) => toDateKey(entry.date) === dateKey,
    );
    const preferred = entries.find((entry) => entry.status === "PREFERED");

    if (
      entries.length > 0 &&
      entries.every((entry) => entry.status === "UNAVAILABLE")
    ) {
      setSelectedMode("UNAVAILABLE_ALL_DAY");
      setSelectedPreferredShift(null);
      return;
    }

    if (preferred) {
      setSelectedMode("PREFERRED");
      setSelectedPreferredShift(preferred.shift.shiftType);
      return;
    }

    setSelectedMode("AVAILABLE_ALL_DAY");
    setSelectedPreferredShift(null);
  };

  const closeModal = () => {
    if (isSaving) {
      return;
    }

    setSelectedDate(null);
    setSelectedMode("AVAILABLE_ALL_DAY");
    setSelectedPreferredShift(null);
  };

  const handleConfirm = async () => {
    if (!employeeId || !selectedDate) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");

      const response = await fetch(
        `${API_URL}/employee-availability/${employeeId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date: selectedDate,
            mode: selectedMode,
            preferredShiftType:
              selectedMode === "PREFERRED" ? selectedPreferredShift : undefined,
          }),
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to save availability");
      }

      const refreshed = await fetch(`${API_URL}/availability/${employeeId}`);
      const refreshedData = (await refreshed.json()) as AvailabilityResponse;

      if (!refreshed.ok || !Array.isArray(refreshedData)) {
        throw new Error("Failed to reload availability");
      }

      setAvailability(refreshedData);
      closeModal();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save availability",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login", { replace: true });
  };

  return (
    <main className="employees-shell availability-shell">
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
            onClick={() => navigate("/employee-schedule")}
          >
            My Schedule
          </button>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="employees-card">
        <h1 className="employees-title">
          {formatTitle(profile?.firstName ?? "")}
        </h1>

        {isLoading ? <p>Loading availability...</p> : null}
        {!isLoading && errorMessage ? (
          <p className="employees-error">{errorMessage}</p>
        ) : null}

        {!isLoading && !errorMessage ? (
          <>
            <div className="availability-toolbar">
              <label className="availability-toolbar-select">
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

              <div className="availability-week-nav">
                <button
                  type="button"
                  className="availability-week-nav-btn"
                  onClick={handlePreviousWeek}
                  disabled={selectedWeekIndex === 0}
                  aria-label="Previous week"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <div className="availability-week-range">
                  {selectedRangeLabel}
                </div>
                <button
                  type="button"
                  className="availability-week-nav-btn"
                  onClick={handleNextWeek}
                  disabled={selectedWeekIndex >= weeks.length - 1}
                  aria-label="Next week"
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>
            </div>

            <div className="availability-grid-wrap">
              <table className="availability-grid-table">
                <thead>
                  <tr>
                    <th className="availability-shift-column" scope="col">
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
                      <th className="availability-shift-row" scope="row">
                        {row.label}
                      </th>
                      {selectedWeek.days.map((day) => {
                        const entries =
                          availabilityByDateAndShift.get(
                            `${day.key}-${row.shift}`,
                          ) ?? [];
                        const summary = summarize(entries);

                        return (
                          <td
                            key={`${day.key}-${row.shift}`}
                            className="availability-cell"
                          >
                            {summary?.kind === "available" ? (
                              <span className="availability-text availability-text--available">
                                {summary.label}
                              </span>
                            ) : null}
                            {summary?.kind === "mixed" ? (
                              <span className="availability-text availability-text--mixed">
                                {summary.label}
                              </span>
                            ) : null}
                            {summary?.kind === "unavailable" ? (
                              <span className="availability-chip availability-chip--unavailable">
                                {summary.label}
                              </span>
                            ) : null}
                            {summary?.kind === "preferred" ? (
                              <span
                                className={`availability-chip availability-chip--preferred availability-chip--preferred-${summary.preferredShift?.toLowerCase() ?? "morning"}`}
                              >
                                <strong>{summary.label}</strong>
                                <em>{summary.detail}</em>
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="availability-action-row">
                <div className="availability-action-spacer" />
                {selectedWeek.days.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    className="availability-open-btn"
                    onClick={() => openAvailabilityModal(day.key)}
                  >
                    <span>Choose</span>
                    <span>availability</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </section>

      {selectedDate ? (
        <div className="availability-modal-overlay" onClick={closeModal}>
          <div
            className="availability-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2>Select availability</h2>

            <div className="availability-mode-row">
              <button
                type="button"
                className={
                  selectedMode === "AVAILABLE_ALL_DAY"
                    ? "availability-mode-btn is-active"
                    : "availability-mode-btn"
                }
                onClick={() => {
                  setSelectedMode("AVAILABLE_ALL_DAY");
                  setSelectedPreferredShift(null);
                }}
              >
                Available all day
              </button>
              <button
                type="button"
                className={
                  selectedMode === "UNAVAILABLE_ALL_DAY"
                    ? "availability-mode-btn is-active availability-mode-btn--danger"
                    : "availability-mode-btn availability-mode-btn--danger"
                }
                onClick={() => {
                  setSelectedMode("UNAVAILABLE_ALL_DAY");
                  setSelectedPreferredShift(null);
                }}
              >
                Unavailable
              </button>
            </div>

            <p className="availability-prefer-title">I prefer:</p>

            <div className="availability-prefer-list">
              {SHIFT_ROWS.map((shiftRow) => (
                <button
                  key={shiftRow.shift}
                  type="button"
                  className={
                    selectedMode === "PREFERRED" &&
                    selectedPreferredShift === shiftRow.shift
                      ? "availability-prefer-btn is-active"
                      : "availability-prefer-btn"
                  }
                  onClick={() => {
                    setSelectedMode("PREFERRED");
                    setSelectedPreferredShift(shiftRow.shift);
                  }}
                >
                  <span>{SHIFT_LABELS[shiftRow.shift]}</span>
                  <strong>{SHIFT_HOURS[shiftRow.shift]}</strong>
                </button>
              ))}
            </div>

            {currentDayEntries.length > 0 ? (
              <p className="availability-modal-note">
                Current status already exists for this day. Saving will update
                it.
              </p>
            ) : null}

            <div className="availability-modal-actions">
              <button
                type="button"
                className="availability-cancel-btn"
                onClick={closeModal}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="availability-confirm-btn"
                onClick={handleConfirm}
                disabled={
                  isSaving ||
                  (selectedMode === "PREFERRED" && !selectedPreferredShift)
                }
              >
                {isSaving ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
