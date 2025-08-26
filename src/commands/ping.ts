import { Command } from 'commander';
import { colors } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { mongoApiClient } from '../services/mongoApi';

/**
 * Ping command to test API connectivity
 */
export const pingCommand = new Command('ping')
  .description('Test connectivity to vulnerability analysis APIs')
  .option('--verbose', 'show detailed connection information')
  .action(async (options) => {
    console.log(colors.title('🏓 Vulnify API Connectivity Test'));
    console.log('');

    if (options.verbose) {
      console.log(colors.muted('Configuration:'));
      console.log(colors.muted(`  MongoDB API URL: ${config.getMongoApiUrl() || 'not set'}`));
      console.log(colors.muted(`  Fallback API URL: ${config.getApiUrl()}`));
      console.log(colors.muted(`  Timeout: ${config.getTimeout()}ms`));
      console.log('');
    }

    const spinner = createSpinner('🔍 Testing API connectivity...');
    spinner.start();

    try {
      // Test connectivity to both APIs
      const connectivity = await mongoApiClient.testConnectivity();
      
      spinner.stop();
      console.log('');

      // Display MongoDB API results
      console.log(colors.info('📡 MongoDB API Service:'));
      if (connectivity.mongodb.available) {
        console.log(colors.success(`  ✅ Available (${connectivity.mongodb.responseTime}ms)`));
      } else {
        console.log(colors.error(`  ❌ Unavailable: ${connectivity.mongodb.error}`));
      }

      // Display Fallback API results
      console.log('');
      console.log(colors.info('🔄 Fallback API Service:'));
      if (connectivity.fallback.available) {
        console.log(colors.success(`  ✅ Available (${connectivity.fallback.responseTime}ms)`));
      } else {
        console.log(colors.error(`  ❌ Unavailable: ${connectivity.fallback.error || 'Not configured'}`));
      }

      // Overall status
      console.log('');
      if (connectivity.mongodb.available || connectivity.fallback.available) {
        console.log(colors.success('🎉 At least one API service is available!'));
        
        if (connectivity.mongodb.available) {
          console.log(colors.info('💡 MongoDB API will be used for faster analysis'));
        } else {
          console.log(colors.warning('⚠️  Using fallback API (may be slower)'));
        }
      } else {
        console.log(colors.error('❌ No API services are available'));
        console.log('');
        console.log(colors.warning('💡 Troubleshooting tips:'));
        console.log('  • Check your internet connection');
        console.log('  • Verify API URLs are correct');
        console.log('  • Check if services are running');
        console.log('  • Try increasing timeout with --timeout option');
      }

      // Show configuration help
      if (!connectivity.mongodb.available && !connectivity.fallback.available) {
        console.log('');
        console.log(colors.info('🔧 Configuration:'));
        console.log('  Set MongoDB API URL:');
        console.log(colors.muted('    export VULNIFY_MONGO_API_URL="https://your-lambda-url"'));
        console.log('  Set fallback API URL:');
        console.log(colors.muted('    export VULNIFY_API_URL="https://api.vulnify.io"'));
      }

    } catch (error) {
      spinner.stop();
      console.log('');
      console.log(colors.error('❌ Connectivity test failed'));
      console.log(colors.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      
      if (options.verbose) {
        logger.error('Ping command failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
      
      process.exit(1);
    }
  });

