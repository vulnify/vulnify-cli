import { Command } from 'commander';
import { EnhancedCliOptions, Ecosystem, ValidationResult } from '../types/cli';
import { colors } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { logger, LogLevel } from '../utils/logger';
import { config } from '../utils/config';
import { DependencyDetector } from '../services/detector';
import { DependencyParser } from '../services/parser';
import { mongoApiClient } from '../services/mongoApi';
import { ReportGenerator } from '../services/reporter';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Validate file parameter
 */
const validateFileParameter = async (filePath: string): Promise<ValidationResult> => {
  if (!filePath) {
    return { valid: false, message: 'File path is required' };
  }

  const absolutePath = path.resolve(filePath);
  
  if (!await fs.pathExists(absolutePath)) {
    return { 
      valid: false, 
      message: `File not found: ${filePath}`,
      suggestions: [
        'Check if the file path is correct',
        'Ensure the file exists in the specified location',
        'Use relative or absolute paths'
      ]
    };
  }

  const stats = await fs.stat(absolutePath);
  if (!stats.isFile()) {
    return { 
      valid: false, 
      message: `Path is not a file: ${filePath}`,
      suggestions: ['Specify a file, not a directory']
    };
  }

  return { valid: true };
};

/**
 * Validate ecosystem parameter
 */
const validateEcosystemParameter = (ecosystem: string): ValidationResult => {
  const supportedEcosystems = ['npm', 'pypi', 'maven', 'nuget', 'rubygems', 'composer', 'go', 'cargo'];
  
  if (!ecosystem) {
    return { valid: false, message: 'Ecosystem is required' };
  }

  if (!supportedEcosystems.includes(ecosystem)) {
    return { 
      valid: false, 
      message: `Unsupported ecosystem: ${ecosystem}`,
      suggestions: [
        `Supported ecosystems: ${supportedEcosystems.join(', ')}`,
        'Use --help to see all available options'
      ]
    };
  }

  return { valid: true };
};

/**
 * Validate output parameter
 */
const validateOutputParameter = (output: string): ValidationResult => {
  const supportedFormats = ['json', 'table', 'summary', 'enhanced'];
  
  if (!output) {
    return { valid: true }; // Optional parameter
  }

  if (!supportedFormats.includes(output)) {
    return { 
      valid: false, 
      message: `Unsupported output format: ${output}`,
      suggestions: [
        `Supported formats: ${supportedFormats.join(', ')}`,
        'Use --help to see format descriptions'
      ]
    };
  }

  return { valid: true };
};

/**
 * Display validation errors with suggestions
 */
const displayValidationError = (result: ValidationResult): void => {
  console.log('');
  console.log(colors.error('❌ Validation Error'));
  console.log(colors.error(result.message || 'Unknown validation error'));
  
  if (result.suggestions && result.suggestions.length > 0) {
    console.log('');
    console.log(colors.warning('💡 Suggestions:'));
    result.suggestions.forEach(suggestion => {
      console.log(`  • ${suggestion}`);
    });
  }
  console.log('');
};


export const testCommand = new Command('test')
  .description('Analyze project dependencies for vulnerabilities')
  .option('-f, --file <path>', 'specify dependency file to analyze')
  .option('-e, --ecosystem <type>', 'force ecosystem detection (npm, pypi, maven, nuget, rubygems, composer, go, cargo)')
  .option('-o, --output <format>', 'output format: enhanced, table, json, summary', 'enhanced')
  .option('-s, --severity <level>', 'filter by severity: critical, high, medium, low')
  .option('-k, --api-key <key>', 'API key for increased rate limits')
  .option('-t, --timeout <ms>', 'request timeout in milliseconds', '30000')
  .option('--max-depth <depth>', 'maximum directory depth for recursive search', '3')
  .option('--verbose', 'enable verbose logging')
  .option('--no-report', 'skip generating report.json file')
  .action(async (options: EnhancedCliOptions) => {
    console.log(colors.title('🔍 Vulnify - Advanced Vulnerability Analysis'));
    console.log('');

    // Enable verbose logging if requested
    if (options.verbose) {
      logger.setLevel(LogLevel.DEBUG);
      logger.debug('Verbose logging enabled');
    }

    // Validate input parameters
    if (options.file) {
      const fileValidation = await validateFileParameter(options.file);
      if (!fileValidation.valid) {
        displayValidationError(fileValidation);
        process.exit(1);
      }
    }

    if (options.ecosystem) {
      const ecosystemValidation = validateEcosystemParameter(options.ecosystem);
      if (!ecosystemValidation.valid) {
        displayValidationError(ecosystemValidation);
        process.exit(1);
      }
    }

    const outputValidation = validateOutputParameter(options.output || 'enhanced');
    if (!outputValidation.valid) {
      displayValidationError(outputValidation);
      process.exit(1);
    }

    const spinner = createSpinner('🚀 Initializing analysis...');
    spinner.start();

    try {
      // Update configuration with command line options
      if (options.apiKey) {
        config.set('api_key', options.apiKey);
      }
      if (options.timeout) {
        config.set('timeout', parseInt(options.timeout.toString(), 10));
      }

      // Initialize services with enhanced options
      const maxDepth = options.maxDepth ? parseInt(options.maxDepth.toString(), 10) : 3;
      const detector = new DependencyDetector(process.cwd(), maxDepth);
      const parser = new DependencyParser();
      const reporter = new ReportGenerator();

      let filePath: string;
      let ecosystem: Ecosystem;

      if (options.file) {
        // Analyze specific file
        spinner.updateText(`📄 Analyzing file: ${options.file}`);
        
        const detectedFile = await detector.detectFile(options.file);
        if (!detectedFile) {
          throw new Error(`Could not detect ecosystem for file: ${options.file}`);
        }
        
        filePath = detectedFile.path;
        ecosystem = options.ecosystem as Ecosystem || detectedFile.ecosystem;
        
        logger.info(`File analysis: ${path.basename(filePath)} (${detector.getEcosystemDisplayName(ecosystem)})`);
      } else {
        // Auto-detect project files with enhanced search
        spinner.updateText('🔍 Detecting project dependencies...');
        
        const detectedFiles = await detector.detectFiles();
        if (detectedFiles.length === 0) {
          throw new Error(`No dependency files found in current directory or subdirectories.
          
💡 Supported files:
  • Node.js: package.json, package-lock.json, yarn.lock
  • Python: requirements.txt, Pipfile, pyproject.toml, setup.py
  • Java: pom.xml, build.gradle, build.gradle.kts
  • .NET: packages.config, *.csproj, *.fsproj, *.vbproj
  • Ruby: Gemfile, Gemfile.lock
  • PHP: composer.json, composer.lock
  • Go: go.mod, go.sum
  • Rust: Cargo.toml, Cargo.lock

🔧 Try:
  • Use --file option to specify a dependency file
  • Use --max-depth to increase search depth
  • Check if you're in the correct project directory`);
        }

        const bestFile = detector.getBestFile(detectedFiles, options.ecosystem as Ecosystem);
        if (!bestFile) {
          throw new Error('Could not determine the best dependency file to analyze');
        }

        filePath = bestFile.path;
        ecosystem = bestFile.ecosystem as Ecosystem;
        
        const relativePath = path.relative(process.cwd(), bestFile.path);
        logger.info(`Detected ${detector.getEcosystemDisplayName(ecosystem)} project: ${relativePath}`);
        
        // Show additional detected files if verbose
        if (options.verbose && detectedFiles.length > 1) {
          console.log('');
          console.log(colors.muted('📋 All detected files:'));
          detectedFiles.forEach(file => {
            const rel = path.relative(process.cwd(), file.path);
            const confidence = Math.round(file.confidence * 100);
            console.log(colors.muted(`  • ${rel} (${file.ecosystem}, ${confidence}% confidence)`));
          });
        }
      }


      // Parse dependencies
      spinner.updateText('📦 Parsing dependencies...');
      const parsedDeps = await parser.parseFile(filePath, ecosystem);
      
      if (parsedDeps.dependencies.length === 0) {
        throw new Error(`No dependencies found in the specified file: ${path.basename(filePath)}`);
      }

      const depCount = parsedDeps.dependencies.length;
      logger.info(`Found ${depCount} dependencies in ${detector.getEcosystemDisplayName(ecosystem)} project`);

      // Analyze vulnerabilities
      spinner.updateText(`🔍 Analyzing ${depCount} dependencies for vulnerabilities...`);
      
      const analysisResponse = await mongoApiClient.analyze({
        ecosystem: parsedDeps.ecosystem,
        dependencies: parsedDeps.dependencies
      });

      if (analysisResponse.status !== 'success' || !analysisResponse.results) {
        throw new Error(analysisResponse.message || 'Analysis failed');
      }

      const results = analysisResponse.results;
      
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

      const vulnCount = results.vulnerabilities_found;
      const scanTime = results.scan_time;
      
      if (vulnCount > 0) {
        spinner.fail(`⚠️  Analysis completed - Found ${vulnCount} vulnerabilities in ${scanTime}`);
      } else {
        spinner.succeed(`✅ Analysis completed - No vulnerabilities found in ${scanTime}`);
      }

      console.log('');

      // Display results with enhanced formatting
      switch (options.output) {
        case 'json':
          reporter.displayJsonResults(results);
          break;
        case 'summary':
          reporter.displaySummaryResults(results);
          break;
        case 'enhanced':
          // For now, fall back to table format until we implement enhanced display
          reporter.displayTableResults(results);
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
          console.log(colors.success(`📄 Report saved: ${path.relative(process.cwd(), reportPath)}`));
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
      spinner.fail('❌ Analysis failed');
      
      if (error instanceof Error) {
        console.log('');
        console.log(colors.error('Error: ' + error.message));
        
        // Provide helpful suggestions based on error type
        if (error.message.includes('No dependency files found')) {
          // Error message already includes suggestions
        } else if (error.message.includes('Network Error') || error.message.includes('ENOTFOUND')) {
          console.log('');
          console.log(colors.warning('💡 Network Issues:'));
          console.log('  • Check your internet connection');
          console.log('  • Verify the API endpoint is accessible');
          console.log('  • Try again in a few moments');
          console.log('  • Use --timeout to increase request timeout');
        } else if (error.message.includes('Rate Limit')) {
          console.log('');
          console.log(colors.warning('💡 Rate Limit Exceeded:'));
          console.log('  • Use --api-key option to get higher rate limits');
          console.log('  • Wait a moment before trying again');
          console.log('  • Consider upgrading your API plan');
        } else if (error.message.includes('timeout')) {
          console.log('');
          console.log(colors.warning('💡 Timeout Issues:'));
          console.log('  • Use --timeout option to increase timeout');
          console.log('  • Check your network connection');
          console.log('  • Try analyzing fewer dependencies at once');
        }
      }
      
      process.exit(2);
    }
  });

