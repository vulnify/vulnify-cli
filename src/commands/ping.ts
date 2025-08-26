import { Command } from 'commander';
import { colors } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { ApiClient } from '../services/api';

/**
 * Ping command to test API connectivity
 */
export const pingCommand = new Command('ping')
  .description('Test connectivity to vulnerability analysis API')
  .option('--verbose', 'show detailed connection information')
  .action(async (options) => {
    console.log(colors.title('🏓 Vulnify API Connectivity Test'));
    console.log('');

    if (options.verbose) {
      console.log(colors.muted('Configuration:'));
      console.log(colors.muted(`  API URL: ${config.getApiUrl()}`));
      console.log(colors.muted(`  Timeout: ${config.getTimeout()}ms`));
      console.log('');
    }

    const spinner = createSpinner('🔍 Testing API connectivity...');
    spinner.start();

    try {
      // Test connectivity to API - simple HTTP check
      const apiClient = new ApiClient();
      const startTime = Date.now();
      
      // Try to make a simple request to test connectivity
      // We'll catch the error but if we get a response (even an error), it means the API is reachable
      try {
        await apiClient.analyze({
          ecosystem: 'npm',
          dependencies: []
        });
      } catch (error) {
        // If we get a validation error, it means the API is reachable
        if (error instanceof Error && (
          error.message.includes('dependencies') || 
          error.message.includes('At least one dependency is required')
        )) {
          // This is expected - empty dependencies array causes validation error
          // but it means the API is responding
        } else {
          throw error;
        }
      }
      
      const responseTime = Date.now() - startTime;
      
      spinner.stop();
      console.log('');

      // Display API results
      console.log(colors.info('📡 API Service:'));
      console.log(colors.success(`  ✅ Available (${responseTime}ms)`));

      // Overall status
      console.log('');
      console.log(colors.success('🎉 API service is available!'));
      console.log(colors.info('💡 Ready to analyze dependencies for vulnerabilities'));

      console.log('');
      console.log(colors.muted('Use "vulnify test" to start analyzing your project'));
      
    } catch (error) {
      spinner.fail('❌ Connectivity test failed');
      
      console.log('');
      console.log(colors.error('Error details:'));
      if (error instanceof Error) {
        console.log(colors.error(`  ${error.message}`));
      } else {
        console.log(colors.error('  Unknown error occurred'));
      }

      console.log('');
      console.log(colors.warning('💡 Troubleshooting:'));
      console.log('  • Check your internet connection');
      console.log('  • Verify the API endpoint is accessible');
      console.log('  • Try again in a few moments');
      console.log('  • Use --verbose for more details');

      if (options.verbose) {
        logger.error('Ping command failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }

      process.exit(1);
    }
  });

