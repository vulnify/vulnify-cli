import * as fs from 'fs-extra';
import * as path from 'path';
import { Config } from '../types';

const DEFAULT_CONFIG: Config = {
  api_url: 'https://api-dev.vulnify.io/api/v1',
  timeout: 30000,
  severity_threshold: 'medium',
  output_format: 'table',
  generate_report: true,
  report_filename: 'vulnify-report.json'
};

export class ConfigManager {
  private config: Config;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadConfig();
  }

  private loadConfig(): void {
    // Try to load from project directory first
    const projectConfigPath = path.join(process.cwd(), '.vulnifyrc');
    if (fs.existsSync(projectConfigPath)) {
      try {
        const projectConfig = fs.readJsonSync(projectConfigPath);
        this.config = { ...this.config, ...projectConfig };
        return;
      } catch (error) {
        console.warn('Warning: Invalid .vulnifyrc in project directory');
      }
    }

    // Try to load from home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const homeConfigPath = path.join(homeDir, '.vulnifyrc');
    if (fs.existsSync(homeConfigPath)) {
      try {
        const homeConfig = fs.readJsonSync(homeConfigPath);
        this.config = { ...this.config, ...homeConfig };
      } catch (error) {
        console.warn('Warning: Invalid .vulnifyrc in home directory');
      }
    }

    // Load from environment variables
    this.loadFromEnv();
  }

  private loadFromEnv(): void {
    if (process.env.VULNIFY_API_KEY) {
      this.config.api_key = process.env.VULNIFY_API_KEY;
    }

    if (process.env.VULNIFY_API_URL) {
      this.config.api_url = process.env.VULNIFY_API_URL;
    }

    if (process.env.VULNIFY_TIMEOUT) {
      const timeout = parseInt(process.env.VULNIFY_TIMEOUT, 10);
      if (!isNaN(timeout)) {
        this.config.timeout = timeout;
      }
    }

    if (process.env.VULNIFY_OUTPUT) {
      const output = process.env.VULNIFY_OUTPUT as Config['output_format'];
      if (['json', 'table', 'summary'].includes(output)) {
        this.config.output_format = output;
      }
    }
  }

  public get(): Config {
    return { ...this.config };
  }

  public set(key: keyof Config, value: Config[keyof Config]): void {
    (this.config as any)[key] = value;
  }

  public getApiUrl(): string {
    return this.config.api_url;
  }

  public getApiKey(): string | undefined {
    return this.config.api_key;
  }

  public getTimeout(): number {
    return this.config.timeout;
  }

  public shouldGenerateReport(): boolean {
    return this.config.generate_report;
  }

  public getReportFilename(): string {
    return this.config.report_filename;
  }
}

export const config = new ConfigManager();

