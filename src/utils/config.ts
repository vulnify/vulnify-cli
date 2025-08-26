import * as fs from 'fs-extra';
import * as path from 'path';
import { Config } from '../types';

const DEFAULT_CONFIG: Config = {
  api_url: 'https://api-dev.vulnify.io',
  // opcional: mongo_api_url: undefined,
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

  // ✅ implementar com tipos explícitos
  public getApiKey(): string | undefined {
    return this.config.api_key;
  }

  // ✅ implementar com tipos explícitos
  public getMongoApiUrl(): string | undefined {
    // suporta chave vinda do rc ou do env
    return this.config.api_url;
  }

  private loadConfig(): void {
    const projectConfigPath = path.join(process.cwd(), '.vulnifyrc');
    if (fs.existsSync(projectConfigPath)) {
      try {
        const projectConfig = fs.readJsonSync(projectConfigPath);
        this.config = { ...this.config, ...projectConfig };
        return;
      } catch {
        console.warn('Warning: Invalid .vulnifyrc in project directory');
      }
    }

    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const homeConfigPath = path.join(homeDir, '.vulnifyrc');
    if (fs.existsSync(homeConfigPath)) {
      try {
        const homeConfig = fs.readJsonSync(homeConfigPath);
        this.config = { ...this.config, ...homeConfig };
      } catch {
        console.warn('Warning: Invalid .vulnifyrc in home directory');
      }
    }

    this.loadFromEnv();
  }

  private loadFromEnv(): void {
    if (process.env.VULNIFY_API_KEY) {
      this.config.api_key = process.env.VULNIFY_API_KEY;
    }

    if (process.env.VULNIFY_API_URL) {
      this.config.api_url = process.env.VULNIFY_API_URL;
    }

    // ✅ opcional: url dedicada para o serviço Mongo
    if (process.env.VULNIFY_MONGO_API_URL) {
      (this.config as any).mongo_api_url = process.env.VULNIFY_MONGO_API_URL;
    }

    if (process.env.VULNIFY_TIMEOUT) {
      const timeout = parseInt(process.env.VULNIFY_TIMEOUT, 10);
      if (!isNaN(timeout)) this.config.timeout = timeout;
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
