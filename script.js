// ===============================
// GLOBAL VARIABLES
// ===============================

// This will store the data from the latest single calculation.
let latestResults = null;

// This array will store ALL calculations as separate rows.
// Think of it like rows in a spreadsheet or records in a database.
let reportRows = [];

// ===============================
// HELPER FUNCTION: formatNumber
// ===============================

/*
  formatNumber(num)
  -----------------
  Takes a raw number (like 12345.678) and returns a nicely formatted string,
  with:
    - commas for thousands
    - exactly 2 decimal places

  Example:
    formatNumber(12345.678) -> "12,345.68"
*/
function formatNumber(num) {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ===============================
// GRAB IMPORTANT ELEMENTS FROM THE DOM
// ===============================

// Button that calculates and adds a row to the report
const calcButton   = document.getElementById("calcButton");

// Export buttons
const jsonButton   = document.getElementById("downloadJson");
const pdfButton    = document.getElementById("downloadPdf");

// Dark mode toggle checkbox
const themeToggle  = document.getElementById("themeToggle");

// ===============================
// THEME HANDLING (LIGHT / DARK MODE)
// ===============================

/*
  applyTheme(theme)
  -----------------
  Adds or removes the "dark-mode" class on <body> depending on the theme.
  theme should be either "dark" or "light".
*/
function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.checked = true;   // Make sure the toggle looks ON
  } else {
    document.body.classList.remove("dark-mode");
    themeToggle.checked = false;  // Make sure the toggle looks OFF
  }
}

// When the page first loads, we look in localStorage to see if the user
// has a saved theme preference. If not, we default to "light".
applyTheme(localStorage.getItem("trex-theme") || "light");

// Whenever the checkbox is clicked, we switch theme and save it.
themeToggle.addEventListener("change", () => {
  // If the checkbox is checked, use dark mode, otherwise light mode
  const mode = themeToggle.checked ? "dark" : "light";

  // Save the user's choice so it stays between visits
  localStorage.setItem("trex-theme", mode);

  // Actually apply the theme
  applyTheme(mode);
});

// ===============================
// REPORT TABLE + SUMMARY RENDERING
// ===============================

/*
  renderReportTable()
  -------------------
  This function:
    - loops over all rows in reportRows
    - builds HTML <tr> rows for the table
    - inserts them into the <tbody id="reportTableBody">

  After drawing the table, it also calls renderReportSummary()
  to update the summary metrics.
*/
function renderReportTable() {
  const tbody = document.getElementById("reportTableBody");
  if (!tbody) return; // Safety check: if the element doesn't exist, do nothing.

  // map(...) transforms each row object into an HTML string for a table row.
  // join("") joins all the rows into one big string without commas.
  tbody.innerHTML = reportRows.map((row, index) => {
    // Convert the ISO timestamp into a readable date/time string.
    const dateLabel = new Date(row.timestamp).toLocaleString();

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${formatNumber(row.income)}</td>
        <td>${formatNumber(row.taxableIncome)}</td>
        <td>${formatNumber(row.taxDue)}</td>
        <td>${dateLabel}</td>
      </tr>
    `;
  }).join("");

  // Update the summary metrics (total tax, average taxable income, etc.)
  renderReportSummary();
}

/*
  renderReportSummary()
  ---------------------
  This function calculates summary metrics from reportRows:
    - how many rows there are
    - total tax due across all rows
    - average taxable income

  Then it displays them in the <div id="reportSummary">.
*/
function renderReportSummary() {
  const summaryEl = document.getElementById("reportSummary");
  if (!summaryEl) return;

  // If there are no rows, show a simple message and disable exports.
  if (reportRows.length === 0) {
    summaryEl.textContent = "No report data yet.";
    jsonButton.disabled = true;
    pdfButton.disabled = true;
    return;
  }

  // Calculate total tax due by summing taxDue for each row.
  const totalTaxDue = reportRows.reduce((sum, row) => sum + row.taxDue, 0);

  // Calculate average taxable income.
  const avgTaxable = reportRows.reduce((sum, row) => sum + row.taxableIncome, 0) / reportRows.length;

  // Build the HTML content for the summary box.
  summaryEl.innerHTML = `
    <p><strong>Rows in report:</strong> ${reportRows.length}</p>
    <p><strong>Total Tax Due / (Refund):</strong> ${formatNumber(totalTaxDue)}</p>
    <p><strong>Average Taxable Income:</strong> ${formatNumber(avgTaxable)}</p>
  `;

  // Since we have at least one row, enable JSON and PDF export buttons.
  jsonButton.disabled = false;
  pdfButton.disabled = false;
}

// ===============================
// CALCULATE & ADD TO REPORT
// ===============================

/*
  Event listener for the "Calculate & Add to Report" button.
  Steps:
    1. Read values from input fields.
    2. Convert them to numbers.
    3. Compute taxable income, tax before payments, and tax due.
    4. Show the latest result.
    5. Add the result as a row in reportRows.
    6. Re-render the report table and summary.
*/
calcButton.addEventListener("click", () => {
  // 1. Get input values (or 0 if empty).
  const income      = Number(document.getElementById("income").value || 0);
  const addbacks    = Number(document.getElementById("addbacks").value || 0);
  const tempDiff    = Number(document.getElementById("tempDiff").value || 0);
  const deductions  = Number(document.getElementById("deductions").value || 0);
  const nol         = Number(document.getElementById("nol").value || 0);
  const taxRate     = Number(document.getElementById("taxRate").value || 0);
  const payments    = Number(document.getElementById("payments").value || 0);

  // 2. Compute main tax values.
  const taxableIncome     = income + addbacks + tempDiff - deductions - nol;
  const taxBeforePayments = taxableIncome * taxRate;
  const taxDue            = taxBeforePayments - payments;

  // 3. Store this run as the latest result (single calculation).
  latestResults = {
    income,
    addbacks,
    tempDiff,
    deductions,
    nol,
    taxRate,
    payments,
    taxableIncome,
    taxBeforePayments,
    taxDue,
    timestamp: new Date().toISOString() // ISO date string for consistent storage
  };

  // 4. Show latest calculation summary in the "Latest Calculation" box.
  document.getElementById("summary").innerHTML = `
    <p><strong>Taxable Income:</strong> ${formatNumber(taxableIncome)}</p>
    <p><strong>Tax Before Payments:</strong> ${formatNumber(taxBeforePayments)}</p>
    <p><strong>Tax Due / (Refund):</strong> ${formatNumber(taxDue)}</p>
  `;

  // 5. Add the latest result to the reportRows array (report history).
  reportRows.push(latestResults);

  // 6. Re-render the table and summary so the new row appears.
  renderReportTable();
});

// ===============================
// EXPORT JSON (FULL REPORT)
// ===============================

/*
  When the JSON button is clicked, we:
    - Make sure there is at least one row in the report.
    - Convert reportRows (array of objects) to a JSON string.
    - Create a Blob (file-like object in memory).
    - Create a temporary <a> tag and click it to start download.
*/
jsonButton.addEventListener("click", () => {
  if (reportRows.length === 0) {
    alert("No report data to export yet.");
    return;
  }

  // Convert the report data into a nicely formatted JSON string.
  const blob = new Blob([JSON.stringify(reportRows, null, 2)], {
    type: "application/json"
  });

  // Create a temporary URL for the Blob.
  const url = URL.createObjectURL(blob);

  // Create a link element and simulate a click to start download.
  const a = document.createElement("a");
  a.href = url;
  a.download = "trex_report.json";
  a.click();

  // Release the temporary URL.
  URL.revokeObjectURL(url);
});

// ===============================
// EXPORT PDF (FULL REPORT)
// ===============================

/*
  When the PDF button is clicked, we:
    - Make sure there is at least one row in the report.
    - Use jsPDF to create a PDF document.
    - Add overall metrics and then each row's details to the PDF.
    - Offer the user a download of "trex_report.pdf".
*/
pdfButton.addEventListener("click", () => {
  if (reportRows.length === 0) {
    alert("No report data to export yet.");
    return;
  }

  // Grab jsPDF from the global window.jspdf object (from the CDN script).
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Main title at the top of the PDF.
  doc.setFontSize(16);
  doc.text("T-REX Tax Report", 10, 15);

  doc.setFontSize(11);

  // Calculate overall metrics for the report.
  const totalTaxDue = reportRows.reduce((sum, row) => sum + row.taxDue, 0);
  const avgTaxable = reportRows.reduce((sum, row) => sum + row.taxableIncome, 0) / reportRows.length;

  // Start printing text a bit lower (y = 25).
  let y = 25;
  const headerLines = [
    `Rows in report: ${reportRows.length}`,
    `Total Tax Due / (Refund): ${formatNumber(totalTaxDue)}`,
    `Average Taxable Income: ${formatNumber(avgTaxable)}`,
    "" // Blank line for spacing
  ];

  // Print each header line.
  headerLines.forEach(line => {
    doc.text(line, 10, y);
    y += 6;  // Move down 6 units for the next line.
  });

  // Now print each row in the report.
  reportRows.forEach((row, index) => {
    const dateLabel = new Date(row.timestamp).toLocaleString();

    const lines = [
      `Row #${index + 1} (${dateLabel})`,
      `  Book Income:           ${formatNumber(row.income)}`,
      `  Taxable Income:        ${formatNumber(row.taxableIncome)}`,
      `  Tax Due / (Refund):    ${formatNumber(row.taxDue)}`,
      `  Tax Rate:              ${row.taxRate}`,
      `  Estimated Payments:    ${formatNumber(row.payments)}`,
      "" // Blank line between rows
    ];

    lines.forEach(line => {
      // If we reach near the bottom of the page, start a new page.
      if (y > 270) {
        doc.addPage();
        y = 20; // Reset y for the new page
      }
      doc.text(line, 10, y);
      y += 6;
    });
  });

  // Finally, trigger the download of the PDF.
  doc.save("trex_report.pdf");
});
