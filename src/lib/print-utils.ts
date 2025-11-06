import type { Classroom, Student, StudentAssignment } from "@/types";

// Helper function to extract the prefix and numeric part of a roll number for sorting
export const extractParts = (roll: string): [string, number] => {
  const parts = roll.split("-");
  if (parts.length < 2) return [roll, 0]; // Fallback for unexpected formats

  const num = parseInt(parts[parts.length - 1], 10);
  const prefix = parts.slice(0, -1).join("-");

  if (!isNaN(num)) return [prefix, num];

  return [roll, 0]; // Fallback if last part isn't a number
};


type PrintReportSummary = {
  paper: string;
  from: string;
  to: string;
  total: number;
};

export type PrintReportData = {
  classroom: Classroom;
  summary: PrintReportSummary[];
  columns: (StudentAssignment | null)[][];
  columnGroups: (string | undefined)[];
  maxRowsInColumn: number;
};


export const generatePrintData = (
  classrooms: Classroom[],
  allAssignments: StudentAssignment[]
): PrintReportData[] => {
  return classrooms
    .map((classroom) => {
      // 1) Collect and order students by serial number within this classroom
      const studentsInClassroom = allAssignments
        .filter((a) => a.assignment?.roomName === classroom.roomName)
        .sort((a, b) => (a.assignment?.serialNumber || 0) - (b.assignment?.serialNumber || 0));

      if (studentsInClassroom.length === 0) return null;

      // 2) Build summary rows: Paper (Branch - Sem) with roll ranges
      const groups = studentsInClassroom.reduce((acc, student) => {
        const key = `${student.paper}-${student.branch}-${student.semesterSection}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(student);
        return acc;
      }, {} as Record<string, StudentAssignment[]>);

      const summary = Object.values(groups)
        .map((group) => {
          if (group.length === 0) return null;
          const { paper, branch, semesterSection } = group[0];
          const rollNumbers = group.map((s) => s.rollNumber).sort((a, b) => {
            const [, numA] = extractParts(a);
            const [, numB] = extractParts(b);
            return numA - numB;
          });
          return {
            paper: `${paper} (${branch} - ${semesterSection})`,
            from: rollNumbers[0],
            to: rollNumbers[rollNumbers.length - 1],
            total: group.length,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .sort((a, b) => a.paper.localeCompare(b.paper));

      // 3) Arrange into physical columns and rows based on bench distribution
      const columns = Math.max(1, classroom.numberOfColumns);
      const benchesPerColumn: number[] = (() => {
        // If an explicit desks-per-column distribution is provided, respect it
        if (classroom.desksPerColumn && classroom.desksPerColumn.length === columns) {
          return classroom.desksPerColumn;
        }
        // Fallback: distribute benches as evenly as possible across columns
        const benches = Math.ceil(classroom.totalCapacity / 2);
        const basePerCol = Math.floor(benches / columns);
        const remainder = benches % columns;
        return Array.from({ length: columns }, (_, i) => basePerCol + (i < remainder ? 1 : 0));
      })();

      // Map deskNumber -> [Side1, Side2]
      const deskMap = new Map<number, { s1: StudentAssignment | null; s2: StudentAssignment | null }>();
      for (const s of studentsInClassroom) {
        const dn = s.assignment!.deskNumber;
        const side = s.assignment!.side;
        const entry = deskMap.get(dn) || { s1: null, s2: null };
        if (side === 'Side 1') entry.s1 = s; else entry.s2 = s;
        deskMap.set(dn, entry);
      }

      const finalColumns: (StudentAssignment | null)[][] = [];
      const finalColumnGroups: (string | undefined)[] = [];

      let deskOffset = 0;
      let maxRows = 0;

      for (let col = 0; col < columns; col++) {
        const rows = benchesPerColumn[col];
        maxRows = Math.max(maxRows, rows);

        const left: (StudentAssignment | null)[] = [];
        const right: (StudentAssignment | null)[] = [];

        for (let row = 1; row <= rows; row++) {
          const deskNumber = deskOffset + row;
          const entry = deskMap.get(deskNumber) || { s1: null, s2: null };
          left.push(entry.s1);
          right.push(entry.s2);
        }

        finalColumns.push(left, right);
        finalColumnGroups.push('Roll No', 'Roll No');
        deskOffset += benchesPerColumn[col];
      }

      // Pad to equal height
      finalColumns.forEach((subCol) => {
        while (subCol.length < maxRows) subCol.push(null);
      });

      return {
        classroom,
        summary,
        columns: finalColumns,
        columnGroups: finalColumnGroups,
        maxRowsInColumn: maxRows,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
};
