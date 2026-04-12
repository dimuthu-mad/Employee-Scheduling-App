import express from "express";
import cors from "cors";
import { AvailabilityStatus, PrismaClient } from "@prisma/client";
import { Position, Role } from "@prisma/client";
import { z } from "zod";
const prisma = new PrismaClient();

const employeeSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  loginCode: z.string().length(4, "Login code must be 4 characters"),
  position: z.enum(["HEAD_WAITER", "WAITER", "RUNNER"]),
  email: z.string(),
});

const loginSchema = z.object({
  email: z.string(),
  loginCode: z.string().length(4, "Login code must be 4 characters"),
});

const shiftSchema = z.object({
  shiftType: z.enum(["MORNING", "AFTERNOON", "EVENING"]),
});

const availabilitySchema = z.object({
  employeeId: z.number(),
  shiftId: z.number(),
  date: z.date(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "PREFERED"]),
});

const scheduleEntrySchema = z.object({
  employeeId: z.number(),
  shiftId: z.number(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

const scheduleIdParamSchema = z.object({
  scheduleEntryId: z.coerce
    .number()
    .int()
    .positive("scheduleEntryId must be a valid number"),
});

const employeeIdParamSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
});

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.post("/login", async (req, res) => {
  try {
    const validatedLogin = loginSchema.safeParse(req.body);
    if (!validatedLogin.success) {
      return res.status(400).json({
        errors: validatedLogin.error,
      });
    }

    const { email, loginCode } = validatedLogin.data;

    const findUser = await prisma.user.findUnique({
      where: { email },
      include: { employee: true },
    });

    if (!findUser) {
      return res.status(401).json({ error: "Invalid email" });
    }

    if (findUser.role === Role.EMPLOYER) {
      return res.status(200).json({
        message: "Employer login successful",
        findUser,
      });
    }

    if (findUser.role === Role.EMPLOYEE) {
      if (!findUser.employee) {
        return res.status(401).json({
          error: "Employee record not found",
        });
      }

      if (findUser.employee.loginCode !== loginCode) {
        return res.status(401).json({
          error: "Invalid email or login code",
        });
      }

      return res.status(200).json({
        message: "Employee login successful",
        findUser,
      });
    }

    return res.status(401).json({
      error: "Invalid login",
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      error: "An error occurred during login",
    });
  }
});

//get all employees
app.get("/employees", async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      include: { user: true },
    });
    res.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

//create new employee
app.post("/employees", async (req, res) => {
  try {
    const validatedEmployee = employeeSchema.safeParse(req.body);
    if (!validatedEmployee.success) {
      return res.status(400).json({
        errors: validatedEmployee.error,
      });
    }
    const { firstName, lastName, loginCode, position, email } =
      validatedEmployee.data;

    const existingEmployee = await prisma.employee.findUnique({
      where: { loginCode },
    });

    if (existingEmployee) {
      return res.status(400).json({
        error: "Login code already exists",
      });
    }

    const newEmployee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        loginCode,
        position: position as Position,
        user: {
          create: {
            email,
            role: Role.EMPLOYEE,
          },
        },
      },
      include: {
        user: true,
      },
    });

    res.status(201).json(newEmployee);
  } catch (error) {
    console.error("Error creating employee:", error);
    res.status(500).json({ error: "Failed to create employee" });
  }
});

app.put("/employees/:employeeId", async (req, res) => {
  try {
    const validatedId = employeeIdParamSchema.safeParse(req.params);
    if (!validatedId.success) {
      return res.status(400).json({
        errors: validatedId.error,
      });
    }
    const validatedEmployee = employeeSchema.safeParse(req.body);
    if (!validatedEmployee.success) {
      return res.status(400).json({
        errors: validatedEmployee.error,
      });
    }

    const { employeeId } = validatedId.data;
    const { firstName, lastName, loginCode, position, email } =
      validatedEmployee.data;

    const existingEmployee = await prisma.employee.findUnique({
      where: { employeeId },
      include: { user: true },
    });
    if (!existingEmployee) {
      return res.status(404).json({
        error: "Employee not found",
      });
    }
    const updatedEmployee = await prisma.employee.update({
      where: { employeeId },
      data: {
        firstName,
        lastName,
        loginCode,
        position,
        user: {
          update: {
            email,
          },
        },
      },
    });
    res.json(updatedEmployee);
  } catch (error) {
    console.error("Error updating employee:", error);
    return res.status(500).json({
      error: "Failed to update employee",
      details: error instanceof Error ? error.message : error,
    });
  }
});

//get employee by id
app.get("/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await prisma.employee.findUnique({
      where: { employeeId: parseInt(id) },
      include: { user: true },
    });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

//get availability for specific employee
app.get("/availability/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const availability = await prisma.availability.findMany({
      where: { employeeId: parseInt(employeeId) },
      include: { employee: true, shift: true },
    });
    if (!availability) {
      return res.status(404).json({ error: "Availability not found" });
    }
    res.json(availability);
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

//update availability status for specific employee, shift and date
app.put("/availability/:employeeId", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const { date, shiftId, status } = req.body;

    if (isNaN(employeeId)) {
      return res.status(400).json({ error: "Invalid employeeId" });
    }

    if (!date || !shiftId || !status) {
      return res.status(400).json({
        error: "date, shiftId and status are required",
      });
    }

    const parsedShiftId = parseInt(shiftId);

    if (isNaN(parsedShiftId)) {
      return res.status(400).json({ error: "Invalid shiftId" });
    }

    const validStatuses = ["AVAILABLE", "UNAVAILABLE", "PREFERED"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use AVAILABLE, UNAVAILABLE, or PREFERED",
      });
    }

    const normalizedDate = new Date(`${date}T00:00:00.000Z`);

    console.log("Request body:", {
      employeeId,
      shiftId: parsedShiftId,
      status,
      normalizedDate,
    });

    const existingAvailability = await prisma.availability.findFirst({
      where: {
        employeeId: employeeId,
        shiftId: parsedShiftId,
        date: normalizedDate,
      },
      include: {
        employee: true,
        shift: true,
      },
    });

    console.log("Existing availability:", existingAvailability);

    if (!existingAvailability) {
      return res.status(404).json({
        error: "Availability not found for this employee, shift, and date",
      });
    }

    const updatedAvailability = await prisma.availability.update({
      where: {
        availabilityId: existingAvailability.availabilityId,
      },
      data: {
        status: status,
      },
      include: {
        employee: true,
        shift: true,
      },
    });

    return res.status(200).json({
      message: "Availability updated successfully",
      availability: updatedAvailability,
    });
  } catch (error: any) {
    console.error("Error updating availability:", error);

    return res.status(500).json({
      error: "Failed to update availability",
      details: error.message,
    });
  }
});

//get all schedules without their availability status
app.get("/schedule", async (req, res) => {
  try {
    const schedule = await prisma.scheduleEntry.findMany({
      include: {
        employee: true,
        shift: true,
      },
    });
    res.json(schedule);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

//create new schedule entry
app.post("/schedule", async (req, res) => {
  try {
    const validatedScheduleEntry = scheduleEntrySchema.safeParse(req.body);
    if (!validatedScheduleEntry.success) {
      return res.status(400).json({
        errors: validatedScheduleEntry.error,
      });
    }
    const { date, employeeId, shiftId } = validatedScheduleEntry.data;

    const normalizedDate = new Date(
      new Date(date).toISOString().split("T")[0] + "T00:00:00.000Z",
    );

    //check existing schedule
    const existingSchedule = await prisma.scheduleEntry.findFirst({
      where: {
        employeeId: employeeId,
        shiftId: shiftId,
        date: normalizedDate,
      },
    });

    if (existingSchedule) {
      return res.status(409).json({
        error: "Schedule already exists for this employee, shift, and date",
      });
    }

    //create schedule
    const newSchedule = await prisma.scheduleEntry.create({
      data: {
        employeeId: employeeId,
        shiftId: shiftId,
        date: normalizedDate,
      },
      include: {
        employee: true,
        shift: true,
      },
    });

    return res.status(201).json({
      message: "Schedule created successfully",
      schedule: newSchedule,
    });
  } catch (error: any) {
    console.error("Create schedule error:", error);

    return res.status(500).json({
      error: "Failed to create schedule",
      details: error.message,
    });
  }
});

app.delete("/schedule/:scheduleEntryId", async (req, res) => {
  try {
    const validation = scheduleIdParamSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid scheduleEntryId",
        details: validation.error.flatten(),
      });
    }

    const { scheduleEntryId } = validation.data;

    const existingScheduleEntry = await prisma.scheduleEntry.findUnique({
      where: { scheduleEntryId },
    });

    if (!existingScheduleEntry) {
      return res.status(404).json({
        error: "Schedule entry not found",
      });
    }

    await prisma.scheduleEntry.delete({
      where: { scheduleEntryId },
    });

    return res.status(200).json({
      message: "Schedule entry deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting schedule entry:", error);

    return res.status(500).json({
      error: "Failed to delete schedule entry",
      details: error.message,
    });
  }
});

//update schedule entry
app.put("/schedule/:scheduleEntryId", async (req, res) => {
  try {
    const scheduleEntryId = parseInt(req.params.scheduleEntryId);
    const { date, employeeId, shiftId } = req.body;
    if (isNaN(scheduleEntryId)) {
      return res.status(400).json({ error: "Invalid scheduleEntryId" });
    }
    if (!date || !employeeId || !shiftId) {
      return res.status(400).json({
        error: "date, employeeId and shiftId are required",
      });
    }
    const parsedEmployeeId = parseInt(employeeId);
    const parsedShiftId = parseInt(shiftId);
    if (isNaN(parsedEmployeeId) || isNaN(parsedShiftId)) {
      return res.status(400).json({ error: "Invalid employeeId or shiftId" });
    }
    const normalizedDate = new Date(`${date}T00:00:00.000Z`);
    const existingScheduleEntry = await prisma.scheduleEntry.findUnique({
      where: { scheduleEntryId },
      include: { employee: true, shift: true },
    });
    if (!existingScheduleEntry) {
      return res.status(404).json({ error: "Schedule entry not found" });
    }
    const updatedScheduleEntry = await prisma.scheduleEntry.update({
      where: { scheduleEntryId },
      data: {
        date: normalizedDate,
        employeeId: parsedEmployeeId,
        shiftId: parsedShiftId,
      },
      include: { employee: true, shift: true },
    });
    return res.status(200).json({
      message: "Schedule entry updated successfully",
      scheduleEntry: updatedScheduleEntry,
    });
  } catch (error: any) {
    console.error("Error updating schedule entry:", error);
    return res.status(500).json({
      error: "Failed to update schedule entry",
      details: error.message,
    });
  }
});

//get all schedules with their availability status
app.get("/schedules-with-availability", async (req, res) => {
  try {
    const schedules = await prisma.scheduleEntry.findMany({
      include: {
        employee: true,
        shift: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    const result = await Promise.all(
      schedules.map(async (schedule) => {
        const normalizedDate = new Date(
          schedule.date.toISOString().split("T")[0] + "T00:00:00.000Z",
        );

        const availability = await prisma.availability.findFirst({
          where: {
            employeeId: schedule.employeeId,
            shiftId: schedule.shiftId,
            date: normalizedDate,
          },
          include: {
            employee: true,
            shift: true,
          },
        });

        return {
          scheduleEntryId: schedule.scheduleEntryId,
          date: schedule.date,

          employee: {
            employeeId: schedule.employee.employeeId,
            firstName: schedule.employee.firstName,
            lastName: schedule.employee.lastName,
            position: schedule.employee.position,
          },

          shift: {
            shiftId: schedule.shift.shiftId,
            shiftType: schedule.shift.shiftType,
          },

          availability: availability
            ? {
                availabilityId: availability.availabilityId,
                status: availability.status,
              }
            : null,
        };
      }),
    );

    return res.status(200).json({
      count: result.length,
      schedules: result,
    });
  } catch (error: any) {
    console.error("Error fetching schedules with availability:", error);

    return res.status(500).json({
      error: "Failed to fetch schedules with availability",
      details: error.message,
    });
  }
});

//get schedule for specific employees with their availability status
app.get("/schedule-with-availability/:employeeId", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);

    if (isNaN(employeeId)) {
      return res.status(400).json({ error: "Invalid employeeId" });
    }

    const schedules = await prisma.scheduleEntry.findMany({
      where: { employeeId },
      include: {
        employee: true,
        shift: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    const result = await Promise.all(
      schedules.map(async (schedule) => {
        const normalizedDate = new Date(
          schedule.date.toISOString().split("T")[0] + "T00:00:00.000Z",
        );

        const matchingAvailability = await prisma.availability.findFirst({
          where: {
            employeeId: schedule.employeeId,
            shiftId: schedule.shiftId,
            date: schedule.date,
          },
          select: {
            status: true,
          },
        });

        return {
          scheduleEntryId: schedule.scheduleEntryId,
          date: schedule.date,
          employee: schedule.employee,
          shift: schedule.shift,
          availabilityStatus: matchingAvailability
            ? matchingAvailability.status
            : "null",
        };
      }),
    );

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error fetching schedule with availability:", error);
    return res.status(500).json({
      error: "Failed to fetch schedule with availability",
      details: error.message,
    });
  }
});

console.log("Server started");
