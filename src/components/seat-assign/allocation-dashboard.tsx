"use client";

import React, { useMemo, useState } from "react";
import type { Classroom, Allocation, Student } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { FileDown, Printer, Loader2, ChevronsUpDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PrintReports } from "./print-reports";
import { createRoot } from "react-dom/client";
import { format } from "date-fns";
import { generatePrintData } from "@/lib/print-utils";
import * as XLSX from 'xlsx';

type AllocationDashboardProps = {
  classrooms: Classroom[];
  students: Student[];
  allocation: Allocation;
  isLoading: boolean;
};

const AllocationDashboard = React.memo(({
  classrooms,
  students,
  allocation,
  isLoading,
}: AllocationDashboardProps) => {
  const [printDate, setPrintDate] = useState(format(new Date(), 'dd.MM.yyyy'));
  const [semester, setSemester] = useState<"ODD" | "EVEN">("ODD");
  const [examType, setExamType] = useState<"MSE1" | "MSE 2" | "Re-MSE">("MSE 2");
  const [selectedShift, setSelectedShift] = useState<"Shift I" | "Shift II">("Shift I");
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isUnassignedOpen, setIsUnassignedOpen] = useState(false);

  const dashboardData = useMemo(() => {
    return classrooms.map((c) => {
      const filled = allocation.assignments.filter(
        (a) => a.assignment?.roomName === c.roomName
      ).length;
      const capacity = c.totalCapacity;
      const remaining = capacity - filled;
      const percentage = capacity > 0 ? (filled / capacity) * 100 : 0;
      return { ...c, filled, remaining, percentage };
    });
  }, [classrooms, allocation.assignments]);


  const totalCapacity = useMemo(() => {
    return classrooms.reduce((acc, c) => acc + c.totalCapacity, 0);
  }, [classrooms]);

  const unassignedByPaper = useMemo(() => {
    return allocation.unassignedStudents.reduce((acc, student) => {
      if (!acc[student.paper]) {
        acc[student.paper] = [];
      }
      acc[student.paper].push(student);
      return acc;
    }, {} as Record<string, Student[]>);
  }, [allocation.unassignedStudents]);

  const downloadMasterSheet = () => {
    const classroomReports = generatePrintData(classrooms, allocation.assignments);
    const wb = XLSX.utils.book_new();

    const currentYear = new Date().getFullYear();
    const nextYear = (currentYear + 1).toString().slice(-2);
    const academicYear = `${currentYear}-${nextYear}`;

    // Helper to extract only subject name from "Subject (Branch - Sem)"
    const extractSubjectName = (value: string) => {
      const match = value.match(/^([^(]+)/);
      return match ? match[1].trim() : value;
    };
    
    // Helper to extract only roll number suffix
    const extractRollSuffix = (rollNumber: string) => {
      const parts = rollNumber.split('-');
      return parts[parts.length - 1];
    };

    // Master sheet
    const masterSheetData = [['Master Seating Chart']];
    masterSheetData.push(['']); // Empty row

    classroomReports.forEach(report => {
        masterSheetData.push([`Room No: ${report.classroom.roomName}`]);
        masterSheetData.push(['Subject', 'From', 'To', 'Total']);
        report.summary.forEach(s => {
            const subjectName = extractSubjectName(s.paper);
            const fromSuffix = extractRollSuffix(s.from);
            const toSuffix = extractRollSuffix(s.to);
            masterSheetData.push([subjectName, fromSuffix, toSuffix, s.total.toString()]);
        });
        const totalAll = report.summary.reduce((acc, s) => acc + s.total, 0);
        masterSheetData.push(['Total', '', '', totalAll.toString()]);
        masterSheetData.push(['']); // Empty row
    });

    const wsMaster = XLSX.utils.aoa_to_sheet(masterSheetData);

    const merges: any[] = [];
    let rowIndex = 0;
    masterSheetData.forEach(row => {
        if (row[0] && row[0].toString().startsWith("Room No:")) {
            merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 3 } });
        }
        rowIndex++;
    });
    wsMaster['!merges'] = merges;


    XLSX.utils.book_append_sheet(wb, wsMaster, 'Master Sheet');

    // Displaying Sheet - Summary of classrooms with papers and roll ranges
    const displayingSheetData = [
      ['Yeshwantrao Chavan College of Engineering'],
      ['(An Autonomous Institution under R.T.M. Nagpur University)'],
      ['Department of Computer Technology'],
      [`Seating Arrangement for ${examType} - ${semester} ${academicYear}`],
      [`Date: ${printDate}`],
      [''],
      ['Room', 'Paper/Subject', 'Branch-Semester', 'Roll Number Range', 'Total Students']
    ];

    // Helper to parse "Subject (Branch - Sem)" into parts
    const parseSummaryPaper = (value: string) => {
      const match = value.match(/^(.*)\((.*)\)$/);
      return {
        paperName: match ? match[1].trim() : value,
        branchSem: match ? match[2].trim() : ''
      };
    };

    classroomReports.forEach(report => {
      const roomName = report.classroom.roomName;
      let isFirstRow = true;
      
      report.summary.forEach(summary => {
        const { paperName, branchSem } = parseSummaryPaper(summary.paper);
        const fromSuffix = extractRollSuffix(summary.from);
        const toSuffix = extractRollSuffix(summary.to);
        const rollRange = `${fromSuffix} to ${toSuffix}`;
        
        displayingSheetData.push([
          isFirstRow ? roomName : '', // Only show room name on first row
          paperName,
          branchSem,
          rollRange,
          summary.total.toString()
        ]);
        isFirstRow = false;
      });
      
      // Helper function inside forEach
      function extractRollSuffix(rollNumber: string) {
        const parts = rollNumber.split('-');
        return parts[parts.length - 1];
      }
      
      // Add empty row between classrooms
      displayingSheetData.push(['', '', '', '', '']);
    });

    const wsDisplaying = XLSX.utils.aoa_to_sheet(displayingSheetData);
    
    // Add merges for header and room names that span multiple rows
    const displayMerges: any[] = [
      // Header merges
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // College name
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // University info
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, // Department
      { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }, // Seating arrangement title
      { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } }, // Date
    ];
    
    let currentRow = 7; // Start after headers (0-5 are header rows, 6 is column headers)
    classroomReports.forEach(report => {
      const rowCount = report.summary.length;
      if (rowCount > 1) {
        displayMerges.push({ 
          s: { r: currentRow, c: 0 }, 
          e: { r: currentRow + rowCount - 1, c: 0 } 
        });
      }
      currentRow += rowCount + 1; // +1 for empty row
    });
    wsDisplaying['!merges'] = displayMerges;

    XLSX.utils.book_append_sheet(wb, wsDisplaying, 'Displaying Sheet');

    // Individual classroom sheets
    classroomReports.forEach(report => {
        const roomName = report.classroom.roomName;
        const individualSheetData = [];

        // Header
        individualSheetData.push(['Yeshwantrao Chavan College of Engineering']);
        individualSheetData.push(['(An Autonomous Institution under R.T.M. Nagpur University)']);
        individualSheetData.push(['Department of Computer Technology']);
        individualSheetData.push([`Seating Arrangement for ${examType} - ${semester} ${academicYear}`]);
        individualSheetData.push(['Date', printDate]);
        individualSheetData.push(['Room No.', roomName]);
        individualSheetData.push(['']);

        // Extract and display unique branch-semester groups
        const branchSemSet = new Set<string>();
        report.columns.forEach(col => {
          col?.forEach(student => {
            if (student?.assignment?.roomName === roomName) {
              branchSemSet.add(`${student.branch}-${student.semesterSection}`);
            }
          });
        });
        const branchSemList = Array.from(branchSemSet).sort();
        if (branchSemList.length > 0) {
          individualSheetData.push(['Branch-Semester Groups:', branchSemList.join(' | ')]);
          individualSheetData.push(['']);
        }

        // Summary table with simplified subject and roll suffixes
        individualSheetData.push(['Subject', 'From', 'To', 'Total']);
        report.summary.forEach(s => {
            const subjectName = extractSubjectName(s.paper);
            const fromSuffix = extractRollSuffix(s.from);
            const toSuffix = extractRollSuffix(s.to);
            individualSheetData.push([subjectName, fromSuffix, toSuffix, s.total]);
        });
        const totalAll = report.summary.reduce((acc, s) => acc + s.total, 0);
        individualSheetData.push(['Total', '', '', totalAll]);
        individualSheetData.push(['']);

        // Seating arrangement
        const maxRows = report.maxRowsInColumn;
        const numCols = report.classroom.numberOfColumns;
        const seatingHeaders = [];
        for (let i = 1; i <= numCols; i++) {
            seatingHeaders.push(`Column ${i}`);
        }
        individualSheetData.push(seatingHeaders);

        for (let r = 0; r < maxRows; r++) {
            const rowData = [];
            for (let c = 0; c < numCols; c++) {
                const student1 = report.columns[c * 2]?.[r];
                const student2 = report.columns[c * 2 + 1]?.[r];
                const rollSuffix1 = student1 ? extractRollSuffix(student1.rollNumber) : '';
                const rollSuffix2 = student2 ? extractRollSuffix(student2.rollNumber) : '';
                const cellValue1 = student1 ? `${student1.assignment?.serialNumber ?? ''}. ${rollSuffix1}` : '';
                const cellValue2 = student2 ? `${student2.assignment?.serialNumber ?? ''}. ${rollSuffix2}` : '';
                rowData.push(`${cellValue1} | ${cellValue2}`);
            }
            individualSheetData.push(rowData);
        }

        const wsRoom = XLSX.utils.aoa_to_sheet(individualSheetData);
        XLSX.utils.book_append_sheet(wb, wsRoom, roomName);
    });


    XLSX.writeFile(wb, 'master_seating_chart.xlsx');
  };

  const handlePrint = () => {
    setIsPrintDialogOpen(false);

    // For now, show all assignments (shifts are for display purposes)
    // Selected shift will be shown in the print header
    const filteredAssignments = allocation.assignments;

    const classroomReports = generatePrintData(classrooms, filteredAssignments);
    console.log("Generated classroom reports for printing:", classroomReports);
    console.log("Number of classrooms to print:", classroomReports.length);
    const printWindow = window.open("about:blank", "_blank");
    if (!printWindow) {
      // Fallback: print via hidden iframe to avoid pop-up blockers
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument!;
      doc.open();
      doc.write(`
        <html>
          <head>
            <title>Classroom Seating Charts</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              @media print {
                @page {
                  size: legal landscape;
                  margin: 0.5in;
                }
              }
              body {
                margin: 0;
                padding: 0;
                background: #fff;
              }
              #print-root {
                background: #fff;
              }
            </style>
          </head>
          <body>
            <div id=\"print-root\"></div>
          </body>
        </html>
      `);
      doc.close();

      const onIframeLoad = () => {
        const iDoc = iframe.contentDocument!;
        const iWin = iframe.contentWindow!;
        const rootEl = iDoc.getElementById('print-root');
        if (!rootEl) return;

        const root = createRoot(rootEl);
        root.render(
          <PrintReports 
            classroomReports={classroomReports} 
            printDate={printDate} 
            semester={semester} 
            examType={examType} 
            shift={selectedShift}
          />
        );

        const waitAndPrint = () => {
          // Ensure the component is rendered and has content
          const ready = rootEl.children.length > 0 && rootEl.querySelector('.bg-white');
          if (ready) {
            iWin.focus();
            setTimeout(() => {
              iWin.print();
            }, 1000); // give Tailwind CDN time to apply styles
            iWin.addEventListener('afterprint', () => {
              try { iframe.remove(); } catch {}
            }, { once: true });
          } else {
            iWin.requestAnimationFrame(waitAndPrint);
          }
        };

        waitAndPrint();
      };

      if (doc.readyState === 'complete') onIframeLoad();
      else iframe.addEventListener('load', onIframeLoad, { once: true });
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Classroom Seating Charts</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            @media print {
              @page {
                size: legal landscape;
                margin: 0.5in;
              }
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
            }
            #print-root {
              background: #fff;
            }
          </style>
        </head>
        <body>
          <div id="print-root"></div>
        </body>
      </html>
    `);
    printWindow.document.close();

    const onLoad = () => {
      const printRootEl = printWindow.document.getElementById("print-root");
      if (!printRootEl) return;

      const root = createRoot(printRootEl);
      root.render(
        <PrintReports 
          classroomReports={classroomReports} 
          printDate={printDate} 
          semester={semester} 
          examType={examType} 
          shift={selectedShift}
        />
      );

      const waitAndPrint = () => {
        // Ensure the component is rendered and has content
        const ready = printRootEl.children.length > 0 && printRootEl.querySelector('.bg-white');
        if (ready) {
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 1000);
        } else {
          printWindow.requestAnimationFrame(waitAndPrint);
        }
      };

      waitAndPrint();
    };

    // Some browsers won't fire load after document.write; call immediately
    try { onLoad(); } catch { /* ignore */ }
  };


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Live Allocation Dashboard</CardTitle>
            <CardDescription>
              Real-time status of student seating arrangements.
            </CardDescription>
          </div>
          {isLoading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classroom</TableHead>
                <TableHead className="text-center">Filled / Capacity</TableHead>
                <TableHead className="w-[120px]">Occupancy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboardData.length > 0 ? (
                dashboardData.map((data) => (
                  <TableRow key={data.id}>
                    <TableCell className="font-medium">{data.roomName}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {data.filled} / {data.totalCapacity}
                    </TableCell>
                    <TableCell>
                      <Progress value={data.percentage} className="w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    No classrooms configured.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <div className="mt-4 p-4 bg-muted/50 rounded-lg flex justify-between items-center">
          <p className="font-medium">Total Students</p>
          <p className="font-bold text-lg">{students.length}</p>
        </div>
        <div className="mt-2 p-4 bg-muted/50 rounded-lg flex justify-between items-center">
          <p className="font-medium text-green-600">Assigned Students</p>
          <p className="font-bold text-lg text-green-600">{allocation.assignments.length}</p>
        </div>

        <Collapsible open={isUnassignedOpen} onOpenChange={setIsUnassignedOpen} className="mt-2">
          <CollapsibleTrigger asChild>
            <button className="w-full">
              <div className="p-4 bg-destructive/10 rounded-lg flex justify-between items-center">
                <p className="font-medium text-destructive">Unassigned Students</p>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-lg text-destructive">{allocation.unassignedStudents.length}</p>
                  {allocation.unassignedStudents.length > 0 && (
                    <ChevronsUpDown className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-4 border border-destructive/20 rounded-lg space-y-2">
              {Object.entries(unassignedByPaper).length > 0 ? (
                Object.entries(unassignedByPaper).map(([paper, unassigned]) => (
                  <div key={paper} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{paper}</span>
                    <span className="font-medium">{unassigned.length} student(s)</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center text-muted-foreground">All students have been assigned.</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

      </CardContent>
      <CardFooter className="flex-col sm:flex-row justify-between gap-4 pt-6">
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadMasterSheet} disabled={!students.length}>
            <FileDown className="mr-2 h-4 w-4" /> Master Sheet (XLSX)
          </Button>
        </div>
        <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!allocation.assignments.length}>
              <Printer className="mr-2 h-4 w-4" /> Print Classroom Sheets
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enter Print Details</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="print-date" className="text-right">
                  Date
                </Label>
                <Input
                  id="print-date"
                  value={printDate}
                  onChange={(e) => setPrintDate(e.target.value)}
                  className="col-span-3"
                  placeholder="dd.mm.yyyy"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">
                  Shift
                </Label>
                <RadioGroup
                  defaultValue="Shift I"
                  className="col-span-3 flex gap-4"
                  onValueChange={(value: "Shift I" | "Shift II") => setSelectedShift(value)}
                  value={selectedShift}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Shift I" id="r-shift-i" />
                    <Label htmlFor="r-shift-i">Shift I</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Shift II" id="r-shift-ii" />
                    <Label htmlFor="r-shift-ii">Shift II</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Semester</Label>
                <RadioGroup
                  defaultValue="ODD"
                  className="col-span-3 flex gap-4"
                  onValueChange={(value: "ODD" | "EVEN") => setSemester(value)}
                  value={semester}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ODD" id="r-odd" />
                    <Label htmlFor="r-odd">ODD sem</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="EVEN" id="r-even" />
                    <Label htmlFor="r-even">EVEN sem</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Exam</Label>
                <RadioGroup
                  defaultValue="MSE 2"
                  className="col-span-3 flex flex-wrap gap-4"
                  onValueChange={(value: "MSE1" | "MSE 2" | "Re-MSE") => setExamType(value)}
                  value={examType}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="MSE1" id="r-mse1" />
                    <Label htmlFor="r-mse1">MSE 1</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="MSE 2" id="r-mse2" />
                    <Label htmlFor="r-mse2">MSE 2</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Re-MSE" id="r-remse" />
                    <Label htmlFor="r-remse">Re-MSE</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" onClick={handlePrint}>Print</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
});

AllocationDashboard.displayName = 'AllocationDashboard';
export default AllocationDashboard;
