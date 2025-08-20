import { Command } from 'commander';
import { colors } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { logger } from '../utils/logger';
import { ApiClient } from '../services/api';

export const infoCommand = new Command('info')
  .description('Show API information and status')
  .action(async () => {
    const spinner = createSpinner('Fetching API information...');
    spinner.start();

    try {
      const apiClient = new ApiClient();
      
      // Get API info and stats
      const [info, stats] = await Promise.all([
        apiClient.getInfo(),
        apiClient.getStats()
      ]);

      spinner.succeed('API information retrieved');

      console.log('');
      console.log(colors.title('Vulnify API Information'));
      console.log('');
      
      console.log(colors.subtitle('API Details:'));
      console.log(`  Name: ${info.name}`);
      console.log(`  Version: ${info.version}`);
      console.log(`  Description: ${info.description}`);
      console.log('');

      console.log(colors.subtitle('Supported Ecosystems:'));
      info.supported_ecosystems.forEach(ecosystem => {
        console.log(`  • ${ecosystem}`);
      });
      console.log('');

      console.log(colors.subtitle('Rate Limits:'));
      console.log(`  Default: ${info.rate_limits.default}`);
      console.log(`  With API Key: ${info.rate_limits.with_api_key}`);
      console.log('');

      console.log(colors.subtitle('Statistics:'));
      console.log(`  Total Scans: ${colors.highlight(stats.stats.total_scans.toLocaleString())}`);
      console.log(`  Total Vulnerabilities: ${colors.highlight(stats.stats.total_vulnerabilities.toLocaleString())}`);
      console.log(`  Cache Hit Ratio: ${colors.highlight((stats.stats.cache_stats.hit_ratio * 100).toFixed(1) + '%')}`);
      console.log(`  Memory Usage: ${colors.highlight(stats.stats.cache_stats.memory_usage_mb + ' MB')}`);
      console.log(`  Uptime: ${colors.highlight(formatUptime(stats.stats.uptime))}`);
      console.log('');

      console.log(colors.subtitle('Available Endpoints:'));
      Object.entries(info.endpoints).forEach(([endpoint, description]) => {
        console.log(`  ${colors.bold(endpoint)}: ${description}`);
      });
      console.log('');

      console.log(colors.muted(`Documentation: ${info.documentation}`));

    } catch (error) {
      spinner.fail('Failed to retrieve API information');
      
      if (error instanceof Error) {
        logger.error('Error details:', error.message);
      }
      
      console.log('');
      console.log(colors.warning('Possible issues:'));
      console.log('  • Check your internet connection');
      console.log('  • Verify API endpoint is accessible');
      console.log('  • Check if API key is valid (if using one)');
      
      process.exit(1);
    }
  });

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

