import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from "chart.js";

// Ensure Chart.js components are registered once globally
ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

/**
 * Official EARIST Color Palette & Design Tokens
 */
export const EARIST_CHART_COLORS = {
  primaryMaroon: "#8B1A1A",
  primaryMaroonSoft: "rgba(139, 26, 26, 0.15)",
  primaryMaroonHover: "#701515",
  secondaryNavy: "#1A365D",
  secondaryNavySoft: "rgba(26, 54, 93, 0.15)",
  accentGold: "#C5A028",
  accentGoldSoft: "rgba(197, 160, 40, 0.2)",
  emeraldGreen: "#10B981",
  emeraldGreenSoft: "rgba(16, 185, 129, 0.15)",
  amberWarning: "#F59E0B",
  amberWarningSoft: "rgba(245, 158, 11, 0.15)",
  dangerRed: "#DC2626",
  dangerRedSoft: "rgba(220, 38, 38, 0.15)",
  purpleIndigo: "#6366F1",
  purpleIndigoSoft: "rgba(99, 102, 241, 0.15)",
  cyanBlue: "#06B6D4",
  cyanBlueSoft: "rgba(6, 182, 212, 0.15)",
  slateNeutral: "#64748B",
  slateNeutralSoft: "rgba(100, 116, 139, 0.12)",
  gridBorder: "#E2E8F0",
} as const;

/**
 * Standard palette array for categorical distribution charts (pie, doughnut, multi-bars)
 */
export const CATEGORICAL_PALETTE = [
  EARIST_CHART_COLORS.primaryMaroon,
  EARIST_CHART_COLORS.secondaryNavy,
  EARIST_CHART_COLORS.accentGold,
  EARIST_CHART_COLORS.emeraldGreen,
  EARIST_CHART_COLORS.purpleIndigo,
  EARIST_CHART_COLORS.cyanBlue,
  EARIST_CHART_COLORS.amberWarning,
  EARIST_CHART_COLORS.slateNeutral,
];

/**
 * Sparkline options preset (for top summary KPI metric cards)
 * Removes axes, gridlines, legends, and borders for a sleek inline mini-trend.
 */
export const sparklineOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: true },
  },
  scales: {
    x: { display: false },
    y: { display: false },
  },
  elements: {
    point: { radius: 0, hoverRadius: 4 },
    line: { tension: 0.4, borderWidth: 2 },
  },
};

/**
 * Base configuration options for Bar charts
 */
export const baseBarOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top",
      labels: {
        font: { family: "Calibri, sans-serif", size: 12 },
        usePointStyle: true,
        boxWidth: 8,
      },
    },
    tooltip: {
      backgroundColor: "#1E293B",
      padding: 10,
      cornerRadius: 8,
      titleFont: { size: 13, weight: "bold" },
      bodyFont: { size: 12 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { family: "Calibri, sans-serif", size: 11 },
        color: "#64748B",
      },
    },
    y: {
      grid: { color: EARIST_CHART_COLORS.gridBorder },
      ticks: {
        font: { family: "Calibri, sans-serif", size: 11 },
        color: "#64748B",
      },
    },
  },
  elements: {
    bar: {
      borderRadius: 6,
    },
  },
};

/**
 * Base configuration options for Horizontal Bar / Funnel charts
 */
export const horizontalBarOptions: ChartOptions<"bar"> = {
  ...baseBarOptions,
  indexAxis: "y",
  scales: {
    x: {
      grid: { color: EARIST_CHART_COLORS.gridBorder },
      ticks: {
        font: { family: "Calibri, sans-serif", size: 11 },
        color: "#64748B",
      },
    },
    y: {
      grid: { display: false },
      ticks: {
        font: { family: "Calibri, sans-serif", size: 11 },
        color: "#64748B",
      },
    },
  },
};

/**
 * Base configuration options for Line / Trend charts
 */
export const baseLineOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top",
      labels: {
        font: { family: "Calibri, sans-serif", size: 12 },
        usePointStyle: true,
        boxWidth: 8,
      },
    },
    tooltip: {
      backgroundColor: "#1E293B",
      padding: 10,
      cornerRadius: 8,
      titleFont: { size: 13, weight: "bold" },
      bodyFont: { size: 12 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { family: "Calibri, sans-serif", size: 11 },
        color: "#64748B",
      },
    },
    y: {
      grid: { color: EARIST_CHART_COLORS.gridBorder },
      ticks: {
        font: { family: "Calibri, sans-serif", size: 11 },
        color: "#64748B",
      },
    },
  },
  elements: {
    point: { radius: 3, hoverRadius: 6 },
    line: { tension: 0.35, borderWidth: 2.5 },
  },
};

/**
 * Base configuration options for Doughnut / Pie charts
 */
export const baseDoughnutOptions: ChartOptions<"doughnut"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        font: { family: "Calibri, sans-serif", size: 12 },
        usePointStyle: true,
        padding: 14,
      },
    },
    tooltip: {
      backgroundColor: "#1E293B",
      padding: 10,
      cornerRadius: 8,
      titleFont: { size: 13, weight: "bold" },
      bodyFont: { size: 12 },
    },
  },
  cutout: "65%",
};

export { ChartJS };
