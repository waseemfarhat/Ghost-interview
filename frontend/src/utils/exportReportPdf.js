import { jsPDF } from 'jspdf';

/**
 * Builds a polished, printable "Confidence & Competency Report" PDF entirely
 * in the browser from a report object returned by GET /reports/session/:id.
 *
 * Field shapes come from the backend Report model + report.service.js:
 *   overallReadinessScore (0..10), confidenceScore/competencyScore/
 *   communicationScore/emotionalStabilityScore (0..100), fillerWordCount,
 *   sentimentSummary ('positive'|'neutral'|'negative'),
 *   emotionSummary { dominantEmotion, distribution: {label: pct},
 *                    averageEyeContact, averageNervousness, timeline },
 *   strengths[], improvementAreas[], isPartial, generatedAt,
 *   session { jobRole { roleName, category }, startTime, endTime }.
 */

const BRAND = { r: 79, g: 70, b: 229 }; // indigo
const INK = { r: 31, g: 41, b: 55 };
const MUTED = { r: 107, g: 114, b: 128 };
const LIGHT_BG = { r: 245, g: 243, b: 255 };
const TRACK = { r: 229, g: 231, b: 235 };
const GREEN = { r: 22, g: 163, b: 74 };
const AMBER = { r: 217, g: 119, b: 6 };

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function capitalize(word) {
  if (!word) return '—';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Draws a labelled horizontal score bar (0..100); returns the new y cursor. */
function drawScoreBar(doc, { label, value, x, y, width }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(label, x, y);

  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont('helvetica', 'bold');
  doc.text(`${Math.round(pct)}/100`, x + width, y, { align: 'right' });

  const barY = y + 3;
  const barH = 6;
  doc.setFillColor(TRACK.r, TRACK.g, TRACK.b);
  doc.roundedRect(x, barY, width, barH, 3, 3, 'F');
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  const fillW = Math.max(2, (width * pct) / 100);
  if (pct > 0) doc.roundedRect(x, barY, fillW, barH, 3, 3, 'F');

  return barY + barH + 12;
}

function sectionTitle(doc, text, x, y, width) {
  doc.setFillColor(LIGHT_BG.r, LIGHT_BG.g, LIGHT_BG.b);
  doc.rect(x, y - 9, width, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(text, x + 4, y + 2);
  doc.setTextColor(INK.r, INK.g, INK.b);
  return y + 16;
}

export function buildReportPdf(report) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // --- Header band ---
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pageWidth, 78, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Ghost Interview', margin, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Confidence & Competency Report', margin, 56);
  doc.setFontSize(10);
  doc.text(fmtDate(report.generatedAt), pageWidth - margin, 56, { align: 'right' });
  y = 100;

  // --- Role + session meta ---
  const roleName = report.session?.jobRole?.roleName || 'Interview';
  const category = report.session?.jobRole?.category;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(roleName, margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  const metaBits = [];
  if (category) metaBits.push(category);
  if (report.session?.startTime) metaBits.push(`Started ${fmtDate(report.session.startTime)}`);
  if (report.isPartial) metaBits.push('Partial report (ended early)');
  doc.text(metaBits.join('   ·   '), margin, y);
  y += 26;

  // --- Overall readiness highlight ---
  const readiness = Number(report.overallReadinessScore) || 0;
  const boxH = 74;
  doc.setFillColor(LIGHT_BG.r, LIGHT_BG.g, LIGHT_BG.b);
  doc.roundedRect(margin, y, contentWidth, boxH, 10, 10, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('Overall Readiness', margin + 20, y + 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(`${readiness.toFixed(1)}`, margin + 20, y + 60);
  doc.setFontSize(14);
  doc.text('/ 10', margin + 20 + doc.getTextWidth(`${readiness.toFixed(1)}`) + 4, y + 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(
    `Filler words: ${report.fillerWordCount ?? 0}    ·    Tone: ${capitalize(report.sentimentSummary)}`,
    pageWidth - margin - 20,
    y + 44,
    { align: 'right' }
  );
  y += boxH + 24;

  // --- Score breakdown ---
  y = sectionTitle(doc, 'Performance breakdown', margin, y, contentWidth);
  y += 8;
  y = drawScoreBar(doc, { label: 'Confidence', value: report.confidenceScore, x: margin, y, width: contentWidth });
  y = drawScoreBar(doc, { label: 'Competency', value: report.competencyScore, x: margin, y, width: contentWidth });
  y = drawScoreBar(doc, { label: 'Communication', value: report.communicationScore, x: margin, y, width: contentWidth });
  y = drawScoreBar(doc, { label: 'Emotional stability', value: report.emotionalStabilityScore, x: margin, y, width: contentWidth });
  y += 6;


  // --- Emotion summary ---
  const summary = report.emotionSummary || {};
  if (summary.dominantEmotion || (summary.distribution && Object.keys(summary.distribution).length)) {
    y = sectionTitle(doc, 'Facial emotion analysis', margin, y, contentWidth);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(INK.r, INK.g, INK.b);
    const dominant = `Dominant emotion: ${capitalize(summary.dominantEmotion)}`;
    const eye = summary.averageEyeContact != null ? `   ·   Avg. eye contact: ${Math.round(summary.averageEyeContact * 100)}%` : '';
    const nerv = summary.averageNervousness != null ? `   ·   Avg. nervousness: ${Math.round(summary.averageNervousness * 100)}%` : '';
    doc.text(dominant + eye + nerv, margin, y);
    y += 18;

    const entries = Object.entries(summary.distribution || {}).sort((a, b) => b[1] - a[1]);
    if (entries.length) {
      const labelW = 90;
      const pctW = 44;
      const barMax = contentWidth - labelW - pctW - 10;
      for (const [label, pct] of entries) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(INK.r, INK.g, INK.b);
        doc.text(capitalize(label), margin, y + 8);
        const trackX = margin + labelW;
        doc.setFillColor(TRACK.r, TRACK.g, TRACK.b);
        doc.roundedRect(trackX, y, barMax, 8, 4, 4, 'F');
        doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
        const w = Math.max(2, (barMax * Number(pct)) / 100);
        if (Number(pct) > 0) doc.roundedRect(trackX, y, w, 8, 4, 4, 'F');
        doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
        doc.text(`${Number(pct).toFixed(1)}%`, trackX + barMax + 6, y + 8);
        y += 16;
      }
    }
    y += 8;
  }

  // --- Strengths & improvements (two columns) ---
  const colGap = 16;
  const colWidth = (contentWidth - colGap) / 2;
  const strengths = report.strengths || [];
  const improvements = report.improvementAreas || [];
  const startY = y;

  const drawList = (title, items, x, w, color) => {
    let cy = sectionTitle(doc, title, x, startY, w);
    cy += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (!items.length) {
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      doc.text('None noted.', x + 2, cy);
      return cy + 14;
    }
    items.forEach((item) => {
      doc.setTextColor(color.r, color.g, color.b);
      doc.text('•', x + 2, cy);
      doc.setTextColor(INK.r, INK.g, INK.b);
      const lines = doc.splitTextToSize(item, w - 14);
      doc.text(lines, x + 12, cy);
      cy += lines.length * 13 + 3;
    });
    return cy;
  };

  const leftBottom = drawList('Strengths', strengths, margin, colWidth, GREEN);
  const rightBottom = drawList('Areas to improve', improvements, margin + colWidth + colGap, colWidth, AMBER);
  y = Math.max(leftBottom, rightBottom) + 10;

  // --- Footer ---
  doc.setDrawColor(TRACK.r, TRACK.g, TRACK.b);
  doc.line(margin, pageHeight - 40, pageWidth - margin, pageHeight - 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(
    'Generated by Ghost Interview (AI Mock Interviewer). Scores are heuristic estimates derived from your recorded answers and facial expressions.',
    margin,
    pageHeight - 26
  );

  const safeRole = roleName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'interview';
  const fileName = `ghost-interview-report-${safeRole}.pdf`;
  doc.save(fileName);
  return fileName;
}

