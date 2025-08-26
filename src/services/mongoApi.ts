import axios, { AxiosInstance } from 'axios';
import { 
  ApiResponse, 
  AnalysisRequest, 
  AutoAnalysisRequest, 
  ApiStats, 
  ApiInfo 
} from '../types/api';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

/**
 * MongoDB API Client for direct vulnerability queries
 * Optimized for high-performance analysis using MongoDB backend
 */
export class MongoApiClient {
  private client: AxiosInstance;
  private fallbackClient?: AxiosInstance;

  constructor() {
    // Primary MongoDB API client
    this.client = axios.create({
      baseURL: config.getMongoApiUrl() || config.getApiUrl(),
      timeout: config.getTimeout(),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'vulnify-cli/1.0.2',
        'X-Client-Version': '2.0.0',
        'X-Source': 'vulnify-cli',
        'Accept-Encoding': 'identity' // Disable compression
      },
      decompress: false, // Disable automatic decompression
      responseType: 'json',
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });

    // Fallback to external APIs if MongoDB service is unavailable
    const fallbackUrl = config.getApiUrl();
    if (fallbackUrl && fallbackUrl !== config.getMongoApiUrl()) {
      this.fallbackClient = axios.create({
        baseURL: fallbackUrl,
        timeout: config.getTimeout(),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'vulnify-cli/1.0.2'
        }
      });

      // Add API key for fallback if available
      const apiKey = config.getApiKey();
      if (apiKey && this.fallbackClient) {
        this.fallbackClient.defaults.params = { apiKey };
      }
    }

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // MongoDB API interceptors
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`API Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error(`API Error: ${error.response.status} ${error.response.statusText}`);
        } else if (error.request) {
          logger.error('API Network Error:', error.message);
        } else {
          logger.error('API Error:', error.message);
        }
        return Promise.reject(error);
      }
    );

    // Fallback API interceptors
    if (this.fallbackClient) {
      this.fallbackClient.interceptors.request.use(
        (config) => {
          logger.debug(`Fallback API Request: ${config.method?.toUpperCase()} ${config.url}`);
          return config;
        },
        (error) => {
          logger.error('Fallback API Request Error:', error.message);
          return Promise.reject(error);
        }
      );

      this.fallbackClient.interceptors.response.use(
        (response) => {
          logger.debug(`Fallback API Response: ${response.status} ${response.statusText}`);
          return response;
        },
        (error) => {
          if (error.response) {
            logger.error(`Fallback API Error: ${error.response.status} ${error.response.statusText}`);
          } else {
            logger.error('Fallback API Error:', error.message);
          }
          return Promise.reject(error);
        }
      );
    }
  }

  /**
   * Analyze dependencies using MongoDB backend with fallback
   */
  async analyze(request: AnalysisRequest): Promise<ApiResponse> {
    try {
      const response = await this.client.post<ApiResponse>('/api/v1/analyze', request);
      return response.data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = (error as any)?.response?.status;
      const responseData = (error as any)?.response?.data;

      // Try fallback API if available
      if (this.fallbackClient) {
        try {
          logger.info('Attempting fallback API', {
            fallbackUrl: this.fallbackClient.defaults.baseURL
          });
          
          const response = await this.fallbackClient.post<ApiResponse>('/api/v1/analyze', request);
          
          logger.info('Fallback analysis completed', {
            ecosystem: request.ecosystem,
            dependencies: request.dependencies.length,
            vulnerabilities: response.data.results?.vulnerabilities_found || 0,
            source: 'fallback'
          });

          return response.data;

        } catch (fallbackError) {
          const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
          const fallbackStatusCode = (fallbackError as any)?.response?.status;
          
          logger.error('Both MongoDB and fallback APIs failed', {
            mongoError: errorMessage,
            mongoStatusCode: statusCode,
            fallbackError: fallbackErrorMessage,
            fallbackStatusCode: fallbackStatusCode
          });
          
          throw new Error('All vulnerability analysis services are unavailable');
        }
      }

      throw error;
    }
  }

  /**
   * Auto-analyze dependencies from file content
   */
  async autoAnalyze(request: AutoAnalysisRequest): Promise<ApiResponse> {
    try {

      const response = await this.client.post<ApiResponse>('/api/v1/analyze/auto', request);


      return response.data;

    } catch (error) {
      logger.warn('Auto-analysis failed, attempting fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ecosystem: request.ecosystem
      });

      // Try fallback API if available
      if (this.fallbackClient) {
        try {
          const response = await this.fallbackClient.post<ApiResponse>('/api/v1/analyze/auto', request);
          
          logger.info('Fallback auto-analysis completed', {
            ecosystem: request.ecosystem,
            dependencies: response.data.results?.total_dependencies || 0,
            vulnerabilities: response.data.results?.vulnerabilities_found || 0,
            source: 'fallback'
          });

          return response.data;

        } catch (fallbackError) {
          logger.error('Both MongoDB and fallback auto-analysis failed', {
            mongoError: error instanceof Error ? error.message : 'Unknown error',
            fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
          });
          throw new Error('All auto-analysis services are unavailable');
        }
      }

      throw error;
    }
  }

/**
 * Get API information
 */
async getInfo(): Promise<ApiInfo> {
  try {
    const response = await this.client.request<ApiInfo>({
      url: 'https://api-dev.vulnify.io/api/v1/info',
      method: 'GET',
      data: {} // força envio de JSON vazio
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get API statistics and health information
 */
async getStats(): Promise<ApiStats> {
  try {
    const response = await this.client.request<ApiStats>({
      url: '/stats',
      method: 'GET',
      data: {} // força envio de JSON vazio
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Health check
 */
async healthCheck(): Promise<{ status: string; timestamp: string }> {
  try {
    const response = await this.client.request({
      url: '/health',
      method: 'GET',
      data: {} // força envio de JSON vazio
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}


  /**
   * Test connectivity to both MongoDB and fallback APIs
   */
  async testConnectivity(): Promise<{
    mongodb: { available: boolean; responseTime?: number; error?: string };
    fallback: { available: boolean; responseTime?: number; error?: string };
  }> {
    const result = {
      mongodb: { available: false, responseTime: undefined as number | undefined, error: undefined as string | undefined },
      fallback: { available: false, responseTime: undefined as number | undefined, error: undefined as string | undefined }
    };

    // Test MongoDB API
    try {
      const start = Date.now();
      await this.client.get('/api/v1/health', { timeout: 5000 });
      result.mongodb.available = true;
      result.mongodb.responseTime = Date.now() - start;
    } catch (error) {
      result.mongodb.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Test fallback API
    if (this.fallbackClient) {
      try {
        const start = Date.now();
        await this.fallbackClient.get('/api/v1/health', { timeout: 5000 });
        result.fallback.available = true;
        result.fallback.responseTime = Date.now() - start;
      } catch (error) {
        result.fallback.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return result;
  }
}

// Export singleton instance
export const mongoApiClient = new MongoApiClient();

