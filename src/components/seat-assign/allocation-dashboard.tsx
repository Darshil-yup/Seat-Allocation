"use client";

import type { Classroom, Allocation, Student } from "@/types";
import { useMemo, useState } from "react";
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


type AllocationDashboardProps = {
  classrooms: Classroom[];
  students: Student[];
  allocation: Allocation;
  isLoading: boolean;
};

const AllocationDashboard = ({
  classrooms,
  students,
  allocation,
  isLoading,
}: AllocationDashboardProps) => {
  const [printDate, setPrintDate] = useState(format(new Date(), 'dd.MM.yyyy'));
  const [semester, setSemester] = useState<"ODD" | "EVEN">("ODD");
  const [examType, setExamType] = useState<"MSE1" | "MSE 2" | "Re-MSE">("MSE 2");
  const [selectedPaper, setSelectedPaper] = useState<string>("all");
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

  const availablePapers = useMemo(() => {
    const papers = new Set<string>();
    allocation.assignments.forEach(assignment => {
      papers.add(assignment.paper);
    });
    return Array.from(papers).sort();
  }, [allocation.assignments]);

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
    let csvContent = "data:text/csv;charset=utf-8,";
    let header = "";

    // Create header
    classroomReports.forEach(report => {
      const roomName = report.classroom.roomName;
      for (let i = 1; i <= report.classroom.numberOfColumns; i++) {
        header += `"${roomName} Col ${i}",`;
      }
      header += ","; // Add a separator column between classrooms
    });
    csvContent += header.slice(0, -1) + "\n";

    // Find max rows needed across all classrooms
    const maxRows = Math.max(
      ...classroomReports.map(r => r.maxRowsInColumn),
      0
    );

    // Create rows
    for (let i = 0; i < maxRows; i++) {
      let row = "";
      classroomReports.forEach(report => {
        for (let j = 0; j < report.classroom.numberOfColumns; j++) {
          const student1 = report.columns[j * 2]?.[i];
          const student2 = report.columns[j * 2 + 1]?.[i];
          const cellValue1 = student1 ? `${student1.rollNumber} (${student1.paper})` : '';
          const cellValue2 = student2 ? `${student2.rollNumber} (${student2.paper})` : '';
          // Combine the two sub-columns into one CSV cell
          row += `"${cellValue1} | ${cellValue2}",`;
        }
        row += ","; // Separator
      });
      csvContent += row.slice(0, -1) + "\n";
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "master_seating_chart.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const handlePrint = () => {
    setIsPrintDialogOpen(false);

    // Filter assignments by selected paper
    const filteredAssignments = selectedPaper === "all" 
      ? allocation.assignments 
      : allocation.assignments.filter(assignment => assignment.paper === selectedPaper);

    const classroomReports = generatePrintData(classrooms, filteredAssignments);

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Classroom Seating Charts</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body>
            <div id="print-root"></div>
          </body>
        </html>
      `);
      printWindow.document.close();

      const printRootEl = printWindow.document.getElementById("print-root");
      if (printRootEl) {
        const root = createRoot(printRootEl);
        root.render(<PrintReports classroomReports={classroomReports} printDate={printDate} semester={semester} examType={examType} />);

        // Give React time to render before printing
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      }
    }
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
          <p className="font-medium">Total Seats</p>
          <p className="font-bold text-lg">{totalCapacity}</p>
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
      <CardFooter className="flex-col sm:flex-row justify-end gap-2 pt-6">
        <Button variant="outline" onClick={downloadMasterSheet} disabled={!students.length}>
          <FileDown className="mr-2 h-4 w-4" /> Master Sheet (CSV)
        </Button>
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
                  Paper/Branch
                </Label>
                <Select value={selectedPaper} onValueChange={setSelectedPaper}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select paper to print" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Papers (Mixed)</SelectItem>
                    {availablePapers.map((paper) => (
                      <SelectItem key={paper} value={paper}>
                        {paper} Only
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
};

export default AllocationDashboard;

