import { Command } from 'commander';
import { CliOptions, Ecosystem } from '../types/cli';
import { colors } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { DependencyDetector } from '../services/detector';
import { DependencyParser } from '../services/parser';
import { ApiClient } from '../services/api';
import { ReportGenerator } from '../services/reporter';

export const testCommand = new Command('test')
  .description('Analyze project dependencies for vulnerabilities')
  .option('-f, --file <path>', 'specify dependency file to analyze')
  .option('-e, --ecosystem <type>', 'force ecosystem detection')
  .option('-o, --output <format>', 'output format: json, table, summary', 'table')
  .option('-s, --severity <level>', 'filter by severity: critical, high, medium, low')
  .option('-k, --api-key <key>', 'API key for increased rate limits')
  .option('-t, --timeout <ms>', 'request timeout in milliseconds', '30000')
  .option('--no-report', 'skip generating report.json file')
  .action(async (options: CliOptions) => {
    console.log(colors.title('Vulnify - Vulnerability Analysis'));
    console.log('');

    const spinner = createSpinner('Initializing analysis...');
    spinner.start();

    try {
      // Update configuration with command line options
      if (options.apiKey) {
        config.set('api_key', options.apiKey);
      }
      if (options.timeout) {
        config.set('timeout', parseInt(options.timeout.toString(), 10));
      }

      // Initialize services
      const detector = new DependencyDetector();
      const parser = new DependencyParser();
      const apiClient = new ApiClient();
      const reporter = new ReportGenerator();

      let filePath: string;
      let ecosystem: Ecosystem;

      if (options.file) {
        // Analyze specific file
        spinner.updateText(`Analyzing file: ${options.file}`);
        
        const detectedFile = await detector.detectFile(options.file);
        if (!detectedFile) {
          throw new Error(`Could not detect ecosystem for file: ${options.file}`);
        }
        
        filePath = detectedFile.path;
        ecosystem = options.ecosystem as Ecosystem || detectedFile.ecosystem;
      } else {
        // Auto-detect project files
        spinner.updateText('Detecting project dependencies...');
        
        const detectedFiles = await detector.detectFiles();
        if (detectedFiles.length === 0) {
          throw new Error('No dependency files found in current directory. Supported files: package.json, requirements.txt, pom.xml, etc.');
        }

        const bestFile = detector.getBestFile(detectedFiles, options.ecosystem as Ecosystem);
        if (!bestFile) {
          throw new Error('Could not determine the best dependency file to analyze');
        }

        filePath = bestFile.path;
        ecosystem = bestFile.ecosystem as Ecosystem;
        
        logger.info(`Detected ${ecosystem} project: ${bestFile.path}`);
      }

      // Parse dependencies
      spinner.updateText('Parsing dependencies...');
      const parsedDeps = await parser.parseFile(filePath, ecosystem);
      
      if (parsedDeps.dependencies.length === 0) {
        throw new Error('No dependencies found in the specified file');
      }

      logger.info(`Found ${parsedDeps.dependencies.length} dependencies`);

      // Analyze vulnerabilities
      spinner.updateText('Analyzing vulnerabilities...');
      
      const analysisResponse = await apiClient.analyze({
        ecosystem: parsedDeps.ecosystem,
        dependencies: parsedDeps.dependencies
      });

      if (analysisResponse.status !== 'success' || !analysisResponse.results) {
        throw new Error(analysisResponse.message || 'Analysis failed');
      }

      const results = analysisResponse.results;
      
      spinner.succeed(`Analysis completed - Found ${results.vulnerabilities_found} vulnerabilities`);

      // Filter by severity if specified
      if (options.severity) {
        const severityLevels = ['low', 'medium', 'high', 'critical'];
        const minSeverityIndex = severityLevels.indexOf(options.severity);
        
        if (minSeverityIndex !== -1) {
          results.dependencies = results.dependencies.map(dep => ({
            ...dep,
            vulnerabilities: dep.vulnerabilities.filter(vuln => {
              const vulnSeverityIndex = severityLevels.indexOf(vuln.severity);
              return vulnSeverityIndex >= minSeverityIndex;
            })
          }));

          // Recalculate summary
          const filteredSummary = { critical: 0, high: 0, medium: 0, low: 0 };
          results.dependencies.forEach(dep => {
            dep.vulnerabilities.forEach(vuln => {
              filteredSummary[vuln.severity]++;
            });
          });
          
          results.summary = filteredSummary;
          results.vulnerabilities_found = Object.values(filteredSummary).reduce((a, b) => a + b, 0);
        }
      }

      // Display results
      switch (options.output) {
        case 'json':
          reporter.displayJsonResults(results);
          break;
        case 'summary':
          reporter.displaySummaryResults(results);
          break;
        case 'table':
        default:
          reporter.displayTableResults(results);
          break;
      }

      // Generate JSON report if requested
      if (!options.noReport && config.shouldGenerateReport()) {
        try {
          const reportPath = await reporter.generateJsonReport(results, {
            project_path: process.cwd(),
            ecosystem: parsedDeps.ecosystem
          }, config.getReportFilename());
          
          console.log('');
          console.log(colors.success(`📄 Report saved: ${reportPath}`));
        } catch (error) {
          logger.warn('Failed to generate JSON report:', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      // Exit with appropriate code
      if (results.vulnerabilities_found > 0) {
        // Check if there are critical or high severity vulnerabilities
        const hasCriticalOrHigh = results.summary.critical > 0 || results.summary.high > 0;
        process.exit(hasCriticalOrHigh ? 1 : 0);
      } else {
        process.exit(0);
      }
      
    } catch (error) {
      spinner.fail('Analysis failed');
      
      if (error instanceof Error) {
        logger.error(error.message);
        
        // Provide helpful suggestions based on error type
        if (error.message.includes('No dependency files found')) {
          console.log('');
          console.log(colors.warning('💡 Suggestions:'));
          console.log('  • Make sure you are in a project directory');
          console.log('  • Use --file option to specify a dependency file');
          console.log('  • Supported files: package.json, requirements.txt, pom.xml, composer.json, etc.');
        } else if (error.message.includes('Network Error') || error.message.includes('ENOTFOUND')) {
          console.log('');
          console.log(colors.warning('💡 Suggestions:'));
          console.log('  • Check your internet connection');
          console.log('  • Verify the API endpoint is accessible');
          console.log('  • Try again in a few moments');
        } else if (error.message.includes('Rate Limit')) {
          console.log('');
          console.log(colors.warning('💡 Suggestions:'));
          console.log('  • Use --api-key option to get higher rate limits');
          console.log('  • Wait a moment before trying again');
        }
      }
      
      process.exit(2);
    }
  });

