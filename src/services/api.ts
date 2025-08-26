import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  ApiResponse, 
  AnalysisRequest, 
  AutoAnalysisRequest, 
  ApiStats, 
  ApiInfo 
} from '../types/api';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.getApiUrl(),
      timeout: config.getTimeout(),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'vulnify-cli/1.0.0'
      }
    });

    // Add API key if available
    const apiKey = config.getApiKey();
    if (apiKey) {
      this.client.defaults.params = { apiKey };
    }

    // Add request/response interceptors for logging
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
          logger.debug('Error details:', error.response.data);
        } else if (error.request) {
          logger.error('Network Error: No response received');
        } else {
          logger.error('Request Error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Analyze dependencies with manual ecosystem specification
   */
  async analyze(request: AnalysisRequest): Promise<ApiResponse> {
    try {
      const response: AxiosResponse<ApiResponse> = await this.client.post('api/v1/analyze', request);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Auto-analyze dependencies from file content
   */
  async autoAnalyze(request: AutoAnalysisRequest): Promise<ApiResponse> {
    try {
      const response: AxiosResponse<ApiResponse> = await this.client.post('api/v1/analyze/auto', request);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
/**
 * Get API information
 */
async getInfo(): Promise<ApiInfo> {
  try {
    const response = await this.client.request<ApiInfo>({
      url: '/api/v1/info',
      method: 'GET',
      data: {} // força envio de JSON vazio
    });
    return response.data;
  } catch (error) {
    throw this.handleError(error);
  }
}

/**
 * Get API statistics and health information
 */
async getStats(): Promise<ApiStats> {
  try {
    const response = await this.client.request<ApiStats>({
      url: '/api/v1/stats',
      method: 'GET',
      data: {} // força envio de JSON vazio
    });
    return response.data;
  } catch (error) {
    throw this.handleError(error);
  }
}

/**
 * Health check
 */
async healthCheck(): Promise<{ status: string; timestamp: string }> {
  try {
    const response = await this.client.request({
      url: '/api/v1/health',
      method: 'GET',
      data: {} // força envio de JSON vazio
    });
    return response.data;
  } catch (error) {
    throw this.handleError(error);
  }
}



  /**
   * Handle API errors and convert to user-friendly messages
   */
  private handleError(error: any): Error {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          return new Error(`Validation Error: ${data.message || 'Invalid request parameters'}`);
        case 401:
          return new Error('Authentication Error: Invalid or missing API key');
        case 403:
          return new Error('Authorization Error: Access denied');
        case 404:
          return new Error('API Error: Endpoint not found');
        case 429:
          return new Error('Rate Limit Error: Too many requests. Consider using an API key for higher limits.');
        case 500:
          return new Error('Server Error: Internal server error occurred');
        case 502:
        case 503:
        case 504:
          return new Error('Service Error: API service is temporarily unavailable');
        default:
          return new Error(`API Error: ${data.message || `HTTP ${status}`}`);
      }
    } else if (error.request) {
      if (error.code === 'ECONNABORTED') {
        return new Error('Timeout Error: Request timed out. Try increasing the timeout with --timeout option.');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return new Error('Network Error: Unable to connect to API. Check your internet connection.');
      } else {
        return new Error('Network Error: No response received from API');
      }
    } else {
      return new Error(`Request Error: ${error.message}`);
    }
  }
}

