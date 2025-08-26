export interface CliOptions {
  file?: string;
  ecosystem?: string;
  output?: 'json' | 'table' | 'summary' | 'enhanced';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  apiKey?: string;
  timeout?: number;
  noReport?: boolean;
}

export interface Config {
  api_key?: string;
  api_url: string;
  timeout: number;
  severity_threshold: 'critical' | 'high' | 'medium' | 'low';
  output_format: 'json' | 'table' | 'summary';
  generate_report: boolean;
  report_filename: string;
}

export interface DetectedFile {
  path: string;
  ecosystem: string;
  confidence: number;
  type: 'primary' | 'lockfile' | 'config';
}

export interface ParsedDependencies {
  ecosystem: string;
  dependencies: Array<{
    name: string;
    version: string;
  }>;
  source_file: string;
}

export interface ReportMetadata {
  cli_version: string;
  scan_timestamp: string;
  request_id: string;
  project_path: string;
  ecosystem: string;
  total_dependencies: number;
  scan_duration_ms: number;
}

export interface Recommendation {
  type: 'upgrade' | 'patch' | 'ignore';
  dependency: string;
  current_version: string;
  recommended_version?: string;
  fixes_vulnerabilities: string[];
  reason?: string;
}

export interface Report {
  metadata: ReportMetadata;
  summary: {
    vulnerabilities_found: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  dependencies: Array<{
    name: string;
    version: string;
    vulnerabilities: Array<{
      id: string;
      title: string;
      severity: string;
      cvss_score?: number;
      description: string;
      references: string[];
      fixed_in?: string[];
      published_date?: string;
    }>;
  }>;
  recommendations: Recommendation[];
}

export type Ecosystem = 
  | 'npm' 
  | 'pypi' 
  | 'maven' 
  | 'nuget' 
  | 'rubygems' 
  | 'composer' 
  | 'go' 
  | 'cargo';

export interface EcosystemConfig {
  name: Ecosystem;
  displayName: string;
  files: {
    primary: string[];
    lockfiles: string[];
    config: string[];
  };
  parser: string;
}


export interface ProjectStructure {
  isMonorepo: boolean;
  rootEcosystem: string | null;
  subprojects: Array<{
    path: string;
    ecosystem: string;
    files: number;
  }>;
  totalFiles: number;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  suggestions?: string[];
}

export interface EnhancedCliOptions extends CliOptions {
  verbose?: boolean;
  maxDepth?: number;
  includeSubdirs?: boolean;
  format?: 'enhanced' | 'table' | 'json' | 'summary';
}

