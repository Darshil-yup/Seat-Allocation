"use client";

import type { PrintReportData } from "@/lib/print-utils";

type PrintReportsProps = {
  classroomReports: PrintReportData[];
  printDate: string;
  semester: "ODD" | "EVEN";
  examType: "MSE1" | "MSE 2" | "Re-MSE";
  shift: string;
};

export const PrintReports = ({
  classroomReports,
  printDate,
  semester,
  examType,
  shift,
}: PrintReportsProps) => {
  const currentYear = new Date().getFullYear();
  const nextYear = (currentYear + 1).toString().slice(-2);
  const academicYear = `${currentYear}-${nextYear}`;

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&family=Arial&display=swap');
          @media print {
            @page {
              /* College requirement: Legal size landscape */
              size: legal landscape;
              margin: 0.5in;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              background: #fff !important;
              color: #000 !important;
            }
            .page-break {
              page-break-before: always;
            }
            .no-print {
              display: none;
            }
            .bg-white {
              background-color: #fff !important;
              print-color-adjust: exact;
            }
            .border {
              border-color: #000 !important;
            }
          }
          .font-college {
            font-family: 'Times New Roman', serif;
          }
          .font-body {
            font-family: 'Arial', sans-serif;
          }
          .report-table, .report-table th, .report-table td {
            border: 1px solid black;
            border-collapse: collapse;
          }
        `}
      </style>
      <div className="p-4 bg-gray-100 font-body">
        <div className="text-center mb-4 no-print">
          <h1 className="text-xl font-bold">Print Preview</h1>
          <p className="text-sm text-gray-500">
            Use your browser's print function (Ctrl/Cmd + P) to print.
          </p>
        </div>
        {classroomReports.map((report, index) => (
          <div
            key={report.classroom.id}
            className={`bg-white p-8 rounded-lg shadow-lg mx-auto w-full ${
              index > 0 ? "page-break mt-8" : ""
            }`}
            style={{ width: '13in' }} // Legal paper printable width (14in page - 2*0.5in margins)
          >
            {/* Header */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold font-college tracking-wider">
                Yeshwantrao Chavan College of Engineering
              </h1>
              <p className="text-md font-college">
                (An Autonomous Institution under R.T.M. Nagpur University)
              </p>
              <h2 className="text-xl font-semibold mt-4">
                Department of Computer Technology
              </h2>
              <h3 className="text-lg font-medium mt-2">
                Seating Arrangement for {examType} - {semester} {academicYear} ({shift})
              </h3>
            </div>

            {/* Summary Section */}
            <div className="flex justify-between items-start mb-6">
              <div className="text-md w-1/4">
                <strong>Date:</strong> {printDate}
              </div>
              <div className="w-1/2">
                <table className="report-table w-full text-sm mx-auto">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="p-2 font-bold" colSpan={4}>
                        Room No. {report.classroom.roomName}
                      </th>
                    </tr>
                    <tr>
                      <th className="p-2">Subject</th>
                      <th className="p-2" colSpan={2}>
                        Branch-Semester & Roll No.
                      </th>
                      <th className="p-2">Total</th>
                    </tr>
                    <tr>
                      <th className="p-2"></th>
                      <th className="p-2 font-medium">Branch-Sem</th>
                      <th className="p-2 font-medium">Roll Number</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.map((s, idx) => (
                      <tr key={idx}>
                        <td className="p-2 text-center">
                          {/* Extract subject name from format "Subject (Branch - Sem)" */}
                          {(() => {
                            const match = s.paper.match(/^([^(]+)/);
                            return match ? match[1].trim() : s.paper;
                          })()}
                        </td>
                        <td className="p-2 text-center">
                          {/* Extract branch-semester from "Subject (Branch - Sem)" */}
                          {(() => {
                            const match = s.paper.match(/\((.*)\)/);
                            return match ? match[1] : '';
                          })()}
                        </td>
                        <td className="p-2 text-center">
                          {(() => {
                            // Extract just the roll suffix from the full roll number
                            const extractRollSuffix = (roll: string) => {
                              const parts = roll.split('-');
                              return parts[parts.length - 1];
                            };
                            const fromSuffix = extractRollSuffix(s.from);
                            const toSuffix = extractRollSuffix(s.to);
                            return `${fromSuffix} to ${toSuffix}`;
                          })()}
                        </td>
                        <td className="p-2 text-center">{s.total}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="p-2 text-right font-bold">
                        Total
                      </td>
                      <td className="p-2 text-center font-bold">
                        {report.summary.reduce((acc, s) => acc + s.total, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="w-1/4"></div>
            </div>

            {/* Branch-Semester Groups - positioned between summary table and seating columns */}
            {(() => {
              const branchSemSet = new Set<string>();
              report.columns.forEach(col => {
                col?.forEach(student => {
                  if (student?.assignment?.roomName === report.classroom.roomName) {
                    branchSemSet.add(`${student.branch}-${student.semesterSection}`);
                  }
                });
              });
              const branchSemList = Array.from(branchSemSet).sort();
              if (branchSemList.length > 0) {
                return (
                  <div className="mb-6 mt-4 p-3 border-2 border-gray-300 rounded-lg bg-gray-50">
                    <p className="text-base font-bold text-center mb-2">Branch-Semester Groups in This Classroom:</p>
                    <p className="text-sm text-center">{branchSemList.join(' | ')}</p>
                  </div>
                );
              }
              return null;
            })()}
            <div className={`grid grid-cols-${report.classroom.numberOfColumns} gap-x-4`}>
              {Array.from({ length: report.classroom.numberOfColumns }).map((_, colIndex) => {
                const mainColHeader = `Column ${colIndex + 1}`;
                const subCol1Index = colIndex * 2;
                const subCol2Index = colIndex * 2 + 1;
                
                const group1 = report.columnGroups[subCol1Index] || 'Roll No';
                const group2 = report.columnGroups[subCol2Index] || 'Roll No';
                
                const students1 = report.columns[subCol1Index] || [];
                const students2 = report.columns[subCol2Index] || [];
                
                const extractRollSuffix = (rollNumber: string) => {
                  const parts = rollNumber.split('-');
                  return parts[parts.length - 1];
                };

                return (
                  <div key={colIndex}>
                    {/* Column Header */}
                    <h3 className="text-md font-bold text-center border-b-2 border-black pb-1 mb-2 relative">
                       {colIndex === 0 && (
                        <span className="float-left font-semibold">DOOR &rarr;</span>
                      )}
                      {mainColHeader}
                    </h3>
                    {/* Seating Table for the Column */}
                    <table className="w-full text-xs report-table">
                       <thead>
                          <tr>
                            <th className="p-1 font-bold w-[15%]">S.No</th>
                            <th className="p-1 font-bold w-[35%]">{group1}</th>
                            <th className="p-1 font-bold w-[15%]">S.No</th>
                            <th className="p-1 font-bold w-[35%]">{group2}</th>
                          </tr>
                       </thead>
                       <tbody>
                        {Array.from({ length: report.maxRowsInColumn }).map(
                          (_, rowIndex) => {
                            const student1 = students1[rowIndex];
                            const student2 = students2[rowIndex];
                            
                            return (
                              <tr key={rowIndex}>
                                <td className="p-1 h-6 text-center">{student1?.assignment?.serialNumber || ''}</td>
                                <td className="p-1 h-6 text-center font-semibold">{student1 ? extractRollSuffix(student1.rollNumber) : ''}</td>
                                <td className="p-1 h-6 text-center">{student2?.assignment?.serialNumber || ''}</td>
                                <td className="p-1 h-6 text-center font-semibold">{student2 ? extractRollSuffix(student2.rollNumber) : ''}</td>
                              </tr>
                            );
                          }
                        )}
                       </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

    