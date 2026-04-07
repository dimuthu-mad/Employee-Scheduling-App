import { PrismaClient } from "@prisma/client";
import { AvailabilityStatus, Position, Role, ShiftType } from "@prisma/client";
const prisma = new PrismaClient();

async function seed() {
  console.log("Start seeding...");

  await prisma.user.create({
    data: {
      email: "manager@restaurant.com",
      role: Role.EMPLOYER,
    },
  });

  // EMPLOYEES (5 employees)

  const users = await Promise.all([
    prisma.user.create({
      data: { email: "john@example.com", role: Role.EMPLOYEE },
    }),
    prisma.user.create({
      data: { email: "anna@example.com", role: Role.EMPLOYEE },
    }),
    prisma.user.create({
      data: { email: "mike@example.com", role: Role.EMPLOYEE },
    }),
    prisma.user.create({
      data: { email: "sara@example.com", role: Role.EMPLOYEE },
    }),
    prisma.user.create({
      data: { email: "david@example.com", role: Role.EMPLOYEE },
    }),
  ]);

  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        firstName: "John",
        lastName: "Silva",
        loginCode: "EMP001",
        position: Position.WAITER,
        userId: users[0].userId,
      },
    }),
    prisma.employee.create({
      data: {
        firstName: "Anna",
        lastName: "Perera",
        loginCode: "EMP002",
        position: Position.RUNNER,
        userId: users[1].userId,
      },
    }),
    prisma.employee.create({
      data: {
        firstName: "Mike",
        lastName: "Fernando",
        loginCode: "EMP003",
        position: Position.HEAD_WAITER,
        userId: users[2].userId,
      },
    }),
    prisma.employee.create({
      data: {
        firstName: "Sara",
        lastName: "Dias",
        loginCode: "EMP004",
        position: Position.WAITER,
        userId: users[3].userId,
      },
    }),
    prisma.employee.create({
      data: {
        firstName: "David",
        lastName: "Kumar",
        loginCode: "EMP005",
        position: Position.RUNNER,
        userId: users[4].userId,
      },
    }),
  ]);

  console.log("Employees created");

  // SHIFTS

  await prisma.shift.createMany({
    data: [
      { shiftType: ShiftType.MORNING },
      { shiftType: ShiftType.AFTERNOON },
      { shiftType: ShiftType.EVENING },
    ],
    skipDuplicates: true,
  });

  const morning = await prisma.shift.findUnique({
    where: { shiftType: ShiftType.MORNING },
  });

  const afternoon = await prisma.shift.findUnique({
    where: { shiftType: ShiftType.AFTERNOON },
  });

  const evening = await prisma.shift.findUnique({
    where: { shiftType: ShiftType.EVENING },
  });

  if (!morning || !afternoon || !evening) {
    throw new Error("Shifts not found");
  }

  console.log("Shifts created");

  // 10 AVAILABILITY

  await prisma.availability.createMany({
    data: [
      {
        employeeId: employees[0].employeeId,
        shiftId: morning.shiftId,
        date: new Date("2026-04-21"),
        status: AvailabilityStatus.AVAILABLE,
      },
      {
        employeeId: employees[0].employeeId,
        shiftId: afternoon.shiftId,
        date: new Date("2026-04-21"),
        status: AvailabilityStatus.UNAVAILABLE,
      },
      {
        employeeId: employees[1].employeeId,
        shiftId: evening.shiftId,
        date: new Date("2026-04-21"),
        status: AvailabilityStatus.PREFERED,
      },
      {
        employeeId: employees[1].employeeId,
        shiftId: morning.shiftId,
        date: new Date("2026-04-22"),
        status: AvailabilityStatus.AVAILABLE,
      },
      {
        employeeId: employees[2].employeeId,
        shiftId: afternoon.shiftId,
        date: new Date("2026-04-22"),
        status: AvailabilityStatus.AVAILABLE,
      },
      {
        employeeId: employees[2].employeeId,
        shiftId: evening.shiftId,
        date: new Date("2026-04-22"),
        status: AvailabilityStatus.UNAVAILABLE,
      },
      {
        employeeId: employees[3].employeeId,
        shiftId: morning.shiftId,
        date: new Date("2026-04-23"),
        status: AvailabilityStatus.AVAILABLE,
      },
      {
        employeeId: employees[3].employeeId,
        shiftId: afternoon.shiftId,
        date: new Date("2026-04-23"),
        status: AvailabilityStatus.PREFERED,
      },
      {
        employeeId: employees[4].employeeId,
        shiftId: evening.shiftId,
        date: new Date("2026-04-23"),
        status: AvailabilityStatus.AVAILABLE,
      },
      {
        employeeId: employees[4].employeeId,
        shiftId: morning.shiftId,
        date: new Date("2026-04-24"),
        status: AvailabilityStatus.UNAVAILABLE,
      },
    ],
    skipDuplicates: true,
  });

  console.log("10 availability records created");

  // 10 SCHEDULE ENTRIES

  await prisma.scheduleEntry.createMany({
    data: [
      {
        employeeId: employees[0].employeeId,
        shiftId: morning.shiftId,
        date: new Date("2026-04-21"),
      },
      {
        employeeId: employees[1].employeeId,
        shiftId: evening.shiftId,
        date: new Date("2026-04-21"),
      },
      {
        employeeId: employees[2].employeeId,
        shiftId: afternoon.shiftId,
        date: new Date("2026-04-21"),
      },
      {
        employeeId: employees[3].employeeId,
        shiftId: morning.shiftId,
        date: new Date("2026-04-22"),
      },
      {
        employeeId: employees[4].employeeId,
        shiftId: evening.shiftId,
        date: new Date("2026-04-22"),
      },
      {
        employeeId: employees[0].employeeId,
        shiftId: afternoon.shiftId,
        date: new Date("2026-04-23"),
      },
      {
        employeeId: employees[1].employeeId,
        shiftId: morning.shiftId,
        date: new Date("2026-04-23"),
      },
      {
        employeeId: employees[2].employeeId,
        shiftId: evening.shiftId,
        date: new Date("2026-04-23"),
      },
      {
        employeeId: employees[3].employeeId,
        shiftId: afternoon.shiftId,
        date: new Date("2026-04-24"),
      },
      {
        employeeId: employees[4].employeeId,
        shiftId: morning.shiftId,
        date: new Date("2026-04-24"),
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seeding finished.");
  console.log("Employee login codes: EMP001, EMP002, EMP003");
}

seed().then(() => prisma.$disconnect);
