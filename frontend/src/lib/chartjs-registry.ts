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
 * Matched strictly to globals.css and UI/UX Playbook:
 * --earist-primary: #8B1A1A (Maroon)
 * --earist-secondary: #A83240 (Crimson)
 * --earist-accent: #D4A843 (Gold)
 * --earist-success: #1E7E4E (Forest Green)
 * --earist-warning: #9B5C00 (Ochre)
 * --earist-border-gray: #D0D7E3
 * --earist-body-text: #4A4A5A
 */
export const EARIST_CHART_COLORS = {
  primaryMaroon: "#8B1A1A",
  primaryMaroonSoft: "rgba(139, 26, 26, 0.12)",
  primaryMaroonHover: "#701515",
  secondaryCrimson: "#A83240",
  secondaryCrimsonSoft: "rgba(168, 50, 64, 0.12)",
  secondaryNavy: "#1A365D",
  secondaryNavySoft: "rgba(26, 54, 93, 0.12)",
  accentGold: "#D4A843",
  accentGoldSoft: "rgba(212, 168, 67, 0.18)",
  emeraldGreen: "#1E7E4E",
  emeraldGreenSoft: "rgba(30, 126, 78, 0.12)",
  amberWarning: "#9B5C00",
  amberWarningSoft: "rgba(155, 92, 0, 0.12)",
  dangerRed: "#8B1A1A",
  dangerRedSoft: "rgba(139, 26, 26, 0.12)",
  purpleIndigo: "#5B4D82",
  purpleIndigoSoft: "rgba(91, 77, 130, 0.12)",
  cyanBlue: "#2B6CB0",
  cyanBlueSoft: "rgba(43, 108, 176, 0.12)",
  slateNeutral: "#4A4A5A",
  slateNeutralSoft: "rgba(74, 74, 90, 0.10)",
  gridBorder: "#E5E9F0",
} as const;

export const CATEGORICAL_PALETTE = [
  EARIST_CHART_COLORS.primaryMaroon,
  EARIST_CHART_COLORS.secondaryNavy,
  EARIST_CHART_COLORS.accentGold,
  EARIST_CHART_COLORS.emeraldGreen,
  EARIST_CHART_COLORS.secondaryCrimson,
  EARIST_CHART_COLORS.cyanBlue,
  EARIST_CHART_COLORS.amberWarning,
  EARIST_CHART_COLORS.slateNeutral,
];

const FONT_FAMILY = '"Calibri", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

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
        font: { family: FONT_FAMILY, size: 12 },
        usePointStyle: true,
        boxWidth: 8,
        color: "#4A4A5A",
      },
    },
    tooltip: {
      backgroundColor: "#2B2B36",
      padding: 10,
      cornerRadius: 6,
      titleFont: { family: FONT_FAMILY, size: 12, weight: "bold" },
      bodyFont: { family: FONT_FAMILY, size: 11 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { family: FONT_FAMILY, size: 11 },
        color: "#4A4A5A",
      },
    },
    y: {
      grid: { color: EARIST_CHART_COLORS.gridBorder },
      ticks: {
        font: { family: FONT_FAMILY, size: 11 },
        color: "#4A4A5A",
      },
    },
  },
  elements: {
    bar: {
      borderRadius: 4,
    },
  },
};

/**
 * Base configuration options for Horizontal Bar charts
 */
export const horizontalBarOptions: ChartOptions<"bar"> = {
  ...baseBarOptions,
  indexAxis: "y",
  scales: {
    x: {
      grid: { color: EARIST_CHART_COLORS.gridBorder },
      ticks: {
        font: { family: FONT_FAMILY, size: 11 },
        color: "#4A4A5A",
      },
    },
    y: {
      grid: { display: false },
      ticks: {
        font: { family: FONT_FAMILY, size: 11 },
        color: "#4A4A5A",
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
        font: { family: FONT_FAMILY, size: 12 },
        usePointStyle: true,
        boxWidth: 8,
        color: "#4A4A5A",
      },
    },
    tooltip: {
      backgroundColor: "#2B2B36",
      padding: 10,
      cornerRadius: 6,
      titleFont: { family: FONT_FAMILY, size: 12, weight: "bold" },
      bodyFont: { family: FONT_FAMILY, size: 11 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { family: FONT_FAMILY, size: 11 },
        color: "#4A4A5A",
      },
    },
    y: {
      grid: { color: EARIST_CHART_COLORS.gridBorder },
      ticks: {
        font: { family: FONT_FAMILY, size: 11 },
        color: "#4A4A5A",
      },
    },
  },
  elements: {
    point: { radius: 3, hoverRadius: 5 },
    line: { tension: 0.3, borderWidth: 2 },
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
        font: { family: FONT_FAMILY, size: 11 },
        usePointStyle: true,
        padding: 12,
        color: "#4A4A5A",
      },
    },
    tooltip: {
      backgroundColor: "#2B2B36",
      padding: 10,
      cornerRadius: 6,
      titleFont: { family: FONT_FAMILY, size: 12, weight: "bold" },
      bodyFont: { family: FONT_FAMILY, size: 11 },
    },
  },
  cutout: "60%",
};

export { ChartJS };
