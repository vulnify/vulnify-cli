import ora from 'ora';
import { colors } from './colors';

export class Spinner {
  private spinner: any;

  constructor(text: string) {
    this.spinner = ora({
      text: colors.info(text),
      spinner: 'dots'
    });
  }

  start(): void {
    this.spinner.start();
  }

  succeed(text?: string): void {
    if (text) {
      this.spinner.succeed(colors.success(text));
    } else {
      this.spinner.succeed();
    }
  }

  fail(text?: string): void {
    if (text) {
      this.spinner.fail(colors.error(text));
    } else {
      this.spinner.fail();
    }
  }

  warn(text?: string): void {
    if (text) {
      this.spinner.warn(colors.warning(text));
    } else {
      this.spinner.warn();
    }
  }

  info(text?: string): void {
    if (text) {
      this.spinner.info(colors.info(text));
    } else {
      this.spinner.info();
    }
  }

  updateText(text: string): void {
    this.spinner.text = colors.info(text);
  }

  stop(): void {
    this.spinner.stop();
  }
}

export function createSpinner(text: string): Spinner {
  return new Spinner(text);
}

