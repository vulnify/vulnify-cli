import chalk from 'chalk';

export const colors = {
  // Severity colors
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.blue,
  
  // Status colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  
  // UI colors
  title: chalk.bold.cyan,
  subtitle: chalk.bold,
  muted: chalk.gray,
  highlight: chalk.magenta,
  
  // Special formatting
  bold: chalk.bold,
  dim: chalk.dim,
  underline: chalk.underline
};

export function getSeverityColor(severity: string): typeof chalk {
  switch (severity.toLowerCase()) {
    case 'critical':
      return colors.critical;
    case 'high':
      return colors.high;
    case 'medium':
      return colors.medium;
    case 'low':
      return colors.low;
    default:
      return colors.muted;
  }
}

export function formatSeverity(severity: string): string {
  const color = getSeverityColor(severity);
  return color(severity.toUpperCase());
}

export function formatCount(count: number, severity: string): string {
  if (count === 0) return colors.muted('0');
  const color = getSeverityColor(severity);
  return color(count.toString());
}

