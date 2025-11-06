# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

SeatAssign is an AI-powered web application for generating intelligent exam seating arrangements with anti-cheating measures. The system ensures students with the same paper are never seated at the same desk and optimally distributes students across multiple classrooms.

## Technology Stack

- **Framework**: Next.js 15 with React 18 and TypeScript
- **UI Components**: Radix UI components with custom shadcn/ui components
- **Styling**: Tailwind CSS
- **Validation**: Zod schemas
- **State Management**: React hooks and local state
- **Export Features**: XLSX for Excel exports, native browser printing
- **AI Integration**: Custom seating algorithm in `/src/ai/flows/`

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (uses turbopack for faster dev)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run typecheck

# Lint code
npm run lint
```

The development server runs on port 9002 (http://localhost:9002).

## Architecture Overview

### Core Components Structure

1. **Main Application** (`src/app/page.tsx`): 
   - Manages overall state for classrooms, students, and allocations
   - Coordinates between the UI components and the seating algorithm
   - Handles snapshot save/load functionality

2. **Classroom Management** (`src/components/seat-assign/classroom-manager.tsx`):
   - Configure exam halls with capacity and layout
   - Supports simple mode (total capacity) and advanced mode (desks per column)
   - Save/load configuration files for reuse

3. **Student Management** (`src/components/seat-assign/student-manager.tsx`):
   - Add students individually or in ranges
   - Tracks roll numbers, papers, branches, and semesters
   - Import from various formats

4. **Allocation Dashboard** (`src/components/seat-assign/allocation-dashboard.tsx`):
   - Real-time status of seat assignments
   - Export master seating sheets (Excel)
   - Print individual classroom sheets
   - Shows unassigned students if capacity insufficient

5. **Seating Algorithm** (`src/ai/flows/intelligent-seating.ts`):
   - Core anti-cheating logic
   - Bench-based allocation (2 students per bench)
   - Semester pairing rules (3↔5 and 4↔6)
   - Prioritizes 4-column rooms over 5-column rooms

### Data Types

The application uses TypeScript types defined in:
- `/src/types/index.ts`: Frontend data types
- `/src/ai/flows/intelligent-seating.ts`: Algorithm-specific types

### State Flow

1. User enters classrooms and students
2. Data flows to the seating algorithm via `prepareFlowInput()`
3. Algorithm processes and returns assignments
4. Assignments transformed back via `processFlowOutput()` 
5. UI updates with real-time allocation status

## Key Implementation Details

### Seating Algorithm

The intelligent seating algorithm (`intelligentSeating`) ensures:
- No two students with the same paper share a bench
- Equal distribution across columns (2 seats per bench)
- Branch grouping when possible
- Semester pairing (3 with 5, 4 with 6)
- Preference for 4-column rooms before 5-column rooms

### Print and Export Features

- **Excel Export**: Creates multi-sheet workbook with Master Sheet, Display Sheet, and per-room sheets
- **Print Reports**: Uses React Portal to create printable versions with proper formatting
- Support for paper filtering (Paper I/Paper II) and semester selection

### Configuration Management

- Save/load classroom configurations as JSON
- Snapshot save/load to preserve complete state including allocations
- Import/export for reuse across exam sessions

## Testing Approach

When working with this codebase:

1. Test the seating algorithm with various classroom layouts
2. Verify anti-cheating constraints are maintained
3. Check proper rendering of exported documents
4. Test with different student counts and room capacities

## Debug Tips

- The algorithm logs detailed information to the console during processing
- Look for "=== AI FLOW RECEIVED ===" and similar patterns in console
- Check the prepareFlowInput() and processFlowOutput() functions for data transformations
- Desktop breakpoint is 768px (configured in use-mobile hook)

## Code Style

- Follows existing patterns in UI components (shadcn/ui style)
- Use memo for components that re-render frequently
- Leverage the existing UI components from `/src/components/ui/`
- Follow the existing file structure and naming conventions