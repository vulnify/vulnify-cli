export interface Dependency {
  name: string;
  version: string;
}

export interface Vulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvss_score?: number;
  description: string;
  references: string[];
  fixed_in?: string[];
  published_date?: string;
}

export interface DependencyAnalysis {
  name: string;
  version: string;
  vulnerabilities: Vulnerability[];
}

export interface VulnerabilitySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface AnalysisResults {
  total_dependencies: number;
  vulnerabilities_found: number;
  scan_time: string;
  ecosystem: string;
  dependencies: DependencyAnalysis[];
  summary: VulnerabilitySummary;
  metadata: {
    request_id: string;
    timestamp: string;
    api_version: string;
  };
}

export interface ApiResponse {
  status: 'success' | 'error';
  request_id: string;
  cached: boolean;
  results?: AnalysisResults;
  detection?: EcosystemDetection;
  error?: string;
  message?: string;
  details?: string;
}

export interface AnalysisRequest {
  ecosystem: string;
  dependencies: Dependency[];
}

export interface AutoAnalysisRequest {
  content: string;
  filename?: string;
}

export interface EcosystemDetection {
  ecosystem: string;
  confidence: number;
  alternatives?: string[];
}

export interface ApiStats {
  status: string;
  stats: {
    total_scans: number;
    total_vulnerabilities: number;
    supported_ecosystems: string[];
    cache_stats: {
      hit_ratio: number;
      total_keys: number;
      memory_usage_mb: number;
    };
    uptime: number;
    version: string;
  };
}

export interface ApiInfo {
  name: string;
  version: string;
  description: string;
  endpoints: Record<string, string>;
  supported_ecosystems: string[];
  rate_limits: {
    default: string;
    with_api_key: string;
  };
  documentation: string;
}

