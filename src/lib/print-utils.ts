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
      // 1. Get all students for the current classroom and sort them by their global serial number
      const studentsInClassroom = allAssignments
        .filter((a) => a.assignment?.roomName === classroom.roomName)
        .sort(
          (a, b) =>
            (a.assignment?.serialNumber || 0) - (b.assignment?.serialNumber || 0)
        );

      if (studentsInClassroom.length === 0) return null;

      // 2. Generate the summary table data
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
          const fromRoll = rollNumbers[0];
          const toRoll = rollNumbers[rollNumbers.length - 1];

          return {
            paper: `${paper} (${branch} - ${semesterSection})`,
            from: fromRoll,
            to: toRoll,
            total: group.length,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .sort((a, b) => a.paper.localeCompare(b.paper));

      // 3. Group students by semester and arrange in columns
      const getSemester = (student: StudentAssignment) => {
        // Extract semester from semesterSection (e.g., "3" from "3-A" or "5" from "5-B")
        const parts = student.semesterSection.split('-');
        return parts[0]?.trim() || '0';
      };

      // Group students by semester
      const studentsBySemester = studentsInClassroom.reduce((acc, student) => {
        const semester = getSemester(student);
        if (!acc[semester]) acc[semester] = [];
        acc[semester].push(student);
        return acc;
      }, {} as Record<string, StudentAssignment[]>);

      // Sort semesters (3, 5, etc.)
      const sortedSemesters = Object.keys(studentsBySemester).sort((a, b) => parseInt(a) - parseInt(b));

      const numberOfColumns = classroom.numberOfColumns * 2; // Each physical column has 2 sub-columns
      const finalColumns: (StudentAssignment | null)[][] = [];
      const finalColumnGroups: (string | undefined)[] = [];

      // Distribute columns among semesters
      const columnsPerSemester = Math.floor(numberOfColumns / sortedSemesters.length);
      const extraColumns = numberOfColumns % sortedSemesters.length;

      let columnIndex = 0;

      for (let semIndex = 0; semIndex < sortedSemesters.length; semIndex++) {
        const semester = sortedSemesters[semIndex];
        const studentsInSemester = studentsBySemester[semester];

        // Calculate how many columns this semester gets
        let semesterColumns = columnsPerSemester;
        if (semIndex < extraColumns) semesterColumns++; // Distribute extra columns

        // Calculate students per column for this semester
        const studentsPerColumn = Math.ceil(studentsInSemester.length / semesterColumns);

        // Create columns for this semester
        for (let i = 0; i < semesterColumns; i++) {
          const startIndex = i * studentsPerColumn;
          const endIndex = startIndex + studentsPerColumn;
          const columnStudents = studentsInSemester.slice(startIndex, endIndex);

          finalColumns.push(columnStudents);
          finalColumnGroups.push(semester);
          columnIndex++;
        }
      }

      // Fill remaining columns if any
      while (finalColumns.length < numberOfColumns) {
        finalColumns.push([]);
        finalColumnGroups.push(undefined);
      }

      // Find the maximum number of rows needed in any sub-column
      const maxRows = Math.max(...finalColumns.map(col => col.length));

      // Pad shorter sub-columns with nulls to ensure equal height in the table
      finalColumns.forEach((subCol) => {
        while (subCol.length < maxRows) {
          subCol.push(null);
        }
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
