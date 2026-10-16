// Synthetic application print QA. Runs without Firebase or production data.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { buildDirectionReportVisualFixtures } from './product-direction-report-fixtures.mjs';
import { buildReportPrintHtml, buildSavedReportPresentation } from '../src/utils/reportPresentation.js';
const output = 'tmp/product-direction/report-pdfs';
await mkdir(output, { recursive: true });
const { cases, generatedAt } = buildDirectionReportVisualFixtures();
const browser = await chromium.launch({ headless: true });
const summary = [];
try {
  for (const fixture of cases) {
    const report = buildSavedReportPresentation(fixture);
    const html = buildReportPrintHtml({ reports: [report], generatedAt, timeZone: 'America/Chicago', context: 'Synthetic release-validation record' });
    await writeFile(`${output}/${fixture.key}.html`, html);
    const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
    await page.setContent(html, { waitUntil: 'load' });
    if (await page.evaluate(() => Boolean(window.__reportInjected))) throw new Error('Report content executed as JavaScript');
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (horizontalOverflow) throw new Error(`Report overflows horizontally: ${fixture.key}`);
    await page.emulateMedia({ media: 'print' });
    for (const format of ['Letter', 'A4']) {
      const path = `${output}/${fixture.key}-${format.toLowerCase()}.pdf`;
      await page.pdf({ path, format, printBackground: true, preferCSSPageSize: false });
      summary.push({ case: fixture.key, format, path, assigned: report.assigned, completed: report.completed, recordedMinutes: report.recordedMinutes,
        countsRequireReview: report.countsRequireReview, corrections: report.corrections.length });
    }
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(`${output}/manifest.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ synthetic: true, outputs: summary }, null, 2));
