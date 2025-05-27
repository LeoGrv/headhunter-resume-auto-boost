#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read coverage summary
const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');

if (!fs.existsSync(coveragePath)) {
  console.error('❌ Coverage summary not found. Run tests with coverage first.');
  process.exit(1);
}

const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
const totalCoverage = coverage.total;

// Calculate overall coverage percentage
const linesCoverage = totalCoverage.lines.pct;
const branchesCoverage = totalCoverage.branches.pct;
const functionsCoverage = totalCoverage.functions.pct;
const statementsCoverage = totalCoverage.statements.pct;

const overallCoverage = Math.round(
  (linesCoverage + branchesCoverage + functionsCoverage + statementsCoverage) / 4
);

// Determine badge color
let color = 'red';
if (overallCoverage >= 80) color = 'brightgreen';
else if (overallCoverage >= 60) color = 'yellow';
else if (overallCoverage >= 40) color = 'orange';

// Generate badge URL
const badgeUrl = `https://img.shields.io/badge/coverage-${overallCoverage}%25-${color}`;

// Create coverage report
const report = {
  overall: overallCoverage,
  lines: linesCoverage,
  branches: branchesCoverage,
  functions: functionsCoverage,
  statements: statementsCoverage,
  badgeUrl: badgeUrl,
  timestamp: new Date().toISOString()
};

// Save coverage report
const reportPath = path.join(__dirname, '../coverage/coverage-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

// Generate README badge
const readmePath = path.join(__dirname, '../README.md');
if (fs.existsSync(readmePath)) {
  let readme = fs.readFileSync(readmePath, 'utf8');
  
  // Replace or add coverage badge
  const badgePattern = /!\[Coverage\]\([^)]+\)/;
  const newBadge = `![Coverage](${badgeUrl})`;
  
  if (badgePattern.test(readme)) {
    readme = readme.replace(badgePattern, newBadge);
  } else {
    // Add badge after title
    const titlePattern = /^# .+$/m;
    if (titlePattern.test(readme)) {
      readme = readme.replace(titlePattern, (match) => `${match}\n\n${newBadge}`);
    }
  }
  
  fs.writeFileSync(readmePath, readme);
  console.log('✅ Updated README.md with coverage badge');
}

console.log('📊 Coverage Report Generated:');
console.log(`   Overall: ${overallCoverage}%`);
console.log(`   Lines: ${linesCoverage}%`);
console.log(`   Branches: ${branchesCoverage}%`);
console.log(`   Functions: ${functionsCoverage}%`);
console.log(`   Statements: ${statementsCoverage}%`);
console.log(`   Badge: ${badgeUrl}`); 