# SeatAssign - Smart Exam Seating Arrangement

A modern web application for generating intelligent exam seating arrangements with anti-cheating measures.

## Features

- **Smart Seating Algorithm**: Intelligent seating that prevents students with the same paper from sitting at the same desk
- **Classroom Management**: Easy setup of multiple classrooms with different capacities
- **Student Management**: Bulk import and individual student entry with branch/semester tracking
- **Real-time Dashboard**: Live allocation status with occupancy tracking
- **Print Reports**: Generate printable classroom seating charts
- **Export Options**: Download master seating sheets in CSV format

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:9002`

## How to Use

1. **Add Classrooms**: Configure your exam halls with capacity and layout
2. **Add Students**: Enter student details with roll numbers and papers
3. **Generate Seating**: The system automatically creates optimal seating arrangements
4. **Print & Export**: Generate reports for exam supervisors

## Technology Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **UI**: Tailwind CSS, Radix UI components
- **Algorithm**: Custom seating algorithm
- **Validation**: Zod schemas
- **State Management**: React hooks

## Anti-Cheating Features

- Students with the same paper are never seated at the same desk
- Intelligent distribution across multiple classrooms
- Sequential desk assignment for easy supervision
- Clear visual separation of different papers/branches

## No External Dependencies

This application works completely offline with no need for API keys or external AI services. The seating algorithm is built-in and optimized for exam scenarios.
