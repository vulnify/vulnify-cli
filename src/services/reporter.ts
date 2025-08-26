import * as fs from 'fs-extra';
import * as path from 'path';
import Table from 'cli-table3';
import { AnalysisResults } from '../types/api';
import { Report, ReportMetadata, Recommendation } from '../types/cli';
import { colors, formatSeverity, formatCount } from '../utils/colors';
import { logger } from '../utils/logger';

export interface EnhancedDisplayOptions {
  ecosystem?: string;
  projectPath?: string;
  verbose?: boolean;
}

export class ReportGenerator {
  /**
   * Generate and save JSON report
   */
  async generateJsonReport(
    results: AnalysisResults,
    metadata: Partial<ReportMetadata>,
    outputPath?: string
  ): Promise<string> {
    const report: Report = {
      metadata: {
        cli_version: '1.0.2',
        scan_timestamp: new Date().toISOString(),
        request_id: results.metadata.request_id,
        project_path: process.cwd(),
        ecosystem: results.ecosystem,
        total_dependencies: results.total_dependencies,
        scan_duration_ms: parseInt(results.scan_time.replace('ms', '')),
        ...metadata
      },
      summary: {
        vulnerabilities_found: results.vulnerabilities_found,
        critical: results.summary.critical,
        high: results.summary.high,
        medium: results.summary.medium,
        low: results.summary.low
      },
      dependencies: results.dependencies.map(dep => ({
        name: dep.name,
        version: dep.version,
        vulnerabilities: dep.vulnerabilities.map(vuln => ({
          id: vuln.id,
          title: vuln.title,
          severity: vuln.severity,
          cvss_score: vuln.cvss_score,
          description: vuln.description,
          references: vuln.references,
          fixed_in: vuln.fixed_in,
          published_date: vuln.published_date
        }))
      })),
      recommendations: this.generateRecommendations(results)
    };

    const fileName = outputPath || 'vulnify-report.json';
    const filePath = path.resolve(fileName);
    
    await fs.writeJson(filePath, report, { spaces: 2 });
    logger.debug(`JSON report saved to: ${filePath}`);
    
    return filePath;
  }

  /**
   * Display results in enhanced format (like the image)
   */
  displayEnhancedResults(results: AnalysisResults, options: EnhancedDisplayOptions = {}): void {
    console.log(colors.title('🔍 Vulnify CLI'));
    console.log('');

    // Project info
    if (options.ecosystem && options.projectPath) {
      console.log(`📦 Found ${results.total_dependencies} dependencies (${options.ecosystem} ecosystem)`);
    } else {
      console.log(`📦 Found ${results.total_dependencies} dependencies`);
    }

    console.log(`🔍 Analyzing vulnerabilities... (${results.scan_time})`);
    
    if (results.vulnerabilities_found > 0) {
      console.log(`⚠️  Found ${results.vulnerabilities_found} vulnerabilities:`);
      console.log('');

      // Display vulnerabilities with emoji indicators
      const vulnerabilityList = this.getVulnerabilityList(results);
      vulnerabilityList.forEach(vuln => {
        const emoji = this.getSeverityEmoji(vuln.severity);
        const severityText = this.getSeverityText(vuln.severity);
        console.log(`${emoji} ${vuln.count} ${severityText}: ${vuln.title}`);
      });
    } else {
      console.log('✅ No vulnerabilities found!');
    }

    console.log('');
    console.log(`📄 Report saved to vulnify-report.json`);
  }

  /**
   * Display results in table format (FIXED - no more blank tables)
   */
  displayTableResults(results: AnalysisResults): void {
    console.log('');
    console.log(colors.title('📊 Vulnerability Analysis Results'));
    console.log('');

    // Summary
    this.displaySummary(results);

    // Vulnerabilities table - FIXED
    if (results.vulnerabilities_found > 0) {
      console.log('');
      console.log(colors.subtitle('🔍 Detected Vulnerabilities:'));
      console.log('');

      const table = new Table({
        head: [
          colors.bold('Package'),
          colors.bold('Version'),
          colors.bold('Vulnerability'),
          colors.bold('Severity'),
          colors.bold('CVSS'),
          colors.bold('Fixed In')
        ],
        colWidths: [20, 15, 40, 12, 8, 15],
        wordWrap: true
      });

      // FIXED: Check if we actually have vulnerabilities to display
      let hasVulnerabilities = false;
      
      for (const dep of results.dependencies) {
        if (dep.vulnerabilities && dep.vulnerabilities.length > 0) {
          hasVulnerabilities = true;
          for (const vuln of dep.vulnerabilities) {
            table.push([
              colors.highlight(dep.name),
              colors.muted(dep.version),
              vuln.title || vuln.id || 'Unknown vulnerability',
              formatSeverity(vuln.severity),
              (vuln.cvss_score && typeof vuln.cvss_score === 'number') ? vuln.cvss_score.toFixed(1) : 'N/A',
              vuln.fixed_in && vuln.fixed_in.length > 0 ? vuln.fixed_in.join(', ') : 'N/A'
            ]);
          }
        }
      }

      if (hasVulnerabilities) {
        console.log(table.toString());
      } else {
        console.log(colors.muted('No vulnerability details available to display.'));
      }
    }

    // Recommendations
    this.displayRecommendations(results);

    // Footer
    console.log('');
    console.log(colors.muted(`Scan completed in ${results.scan_time}`));
    console.log(colors.muted(`Request ID: ${results.metadata.request_id}`));
  }

  /**
   * Display results in JSON format
   */
  displayJsonResults(results: AnalysisResults): void {
    console.log(JSON.stringify(results, null, 2));
  }

  /**
   * Display results in summary format
   */
  displaySummaryResults(results: AnalysisResults): void {
    console.log('');
    console.log(colors.title('📋 Vulnerability Summary'));
    console.log('');

    this.displaySummary(results);

    if (results.vulnerabilities_found > 0) {
      console.log('');
      console.log(colors.subtitle('📦 Affected Packages:'));
      
      const affectedPackages = results.dependencies.filter(dep => 
        dep.vulnerabilities && dep.vulnerabilities.length > 0
      );
      
      for (const dep of affectedPackages) {
        const severities = dep.vulnerabilities.map(v => v.severity);
        const highestSeverity = this.getHighestSeverity(severities);
        
        console.log(`  ${formatSeverity(highestSeverity)} ${colors.highlight(dep.name)}@${colors.muted(dep.version)} (${dep.vulnerabilities.length} vulnerabilities)`);
      }
    }

    console.log('');
    console.log(colors.muted(`Scan completed in ${results.scan_time}`));
  }

  /**
   * Display summary statistics
   */
  private displaySummary(results: AnalysisResults): void {
    const { summary } = results;
    
    console.log(`${colors.info('📦')} Total Dependencies: ${colors.highlight(results.total_dependencies.toString())}`);
    console.log(`${colors.error('🚨')} Vulnerabilities Found: ${colors.highlight(results.vulnerabilities_found.toString())}`);
    console.log('');

    if (results.vulnerabilities_found > 0) {
      console.log('Severity Breakdown:');
      console.log(`  ${formatCount(summary.critical, 'critical')} Critical`);
      console.log(`  ${formatCount(summary.high, 'high')} High`);
      console.log(`  ${formatCount(summary.medium, 'medium')} Medium`);
      console.log(`  ${formatCount(summary.low, 'low')} Low`);
    } else {
      console.log(colors.success('✅ No vulnerabilities found!'));
    }
  }

  /**
   * Display recommendations
   */
  private displayRecommendations(results: AnalysisResults): void {
    const recommendations = this.generateRecommendations(results);
    
    if (recommendations.length > 0) {
      console.log('');
      console.log(colors.subtitle('💡 Recommendations:'));
      console.log('');

      for (const rec of recommendations) {
        switch (rec.type) {
          case 'upgrade':
            console.log(`  ${colors.success('↗')} Upgrade ${colors.highlight(rec.dependency)} from ${colors.muted(rec.current_version)} to ${colors.success(rec.recommended_version || 'latest')}`);
            if (rec.fixes_vulnerabilities.length > 0) {
              console.log(`     Fixes: ${rec.fixes_vulnerabilities.join(', ')}`);
            }
            break;
          case 'patch':
            console.log(`  ${colors.warning('🔧')} Apply security patch for ${colors.highlight(rec.dependency)}`);
            break;
          case 'ignore':
            console.log(`  ${colors.muted('⚠')} Consider reviewing ${colors.highlight(rec.dependency)} (${rec.reason})`);
            break;
        }
      }
    }
  }

  /**
   * Generate recommendations based on analysis results
   */
  private generateRecommendations(results: AnalysisResults): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const dep of results.dependencies) {
      if (dep.vulnerabilities && dep.vulnerabilities.length > 0) {
        // Find the best version that fixes vulnerabilities
        const allFixedVersions = dep.vulnerabilities
          .flatMap(v => v.fixed_in || [])
          .filter(Boolean);

        if (allFixedVersions.length > 0) {
          // Get the latest fixed version
          const recommendedVersion = allFixedVersions[allFixedVersions.length - 1];
          
          recommendations.push({
            type: 'upgrade',
            dependency: dep.name,
            current_version: dep.version,
            recommended_version: recommendedVersion,
            fixes_vulnerabilities: dep.vulnerabilities.map(v => v.id)
          });
        } else {
          // No fixed version available
          const hasCriticalOrHigh = dep.vulnerabilities.some(v => 
            v.severity === 'critical' || v.severity === 'high'
          );

          if (hasCriticalOrHigh) {
            recommendations.push({
              type: 'ignore',
              dependency: dep.name,
              current_version: dep.version,
              fixes_vulnerabilities: dep.vulnerabilities.map(v => v.id),
              reason: 'No fixed version available for critical/high severity vulnerabilities'
            });
          }
        }
      }
    }

    return recommendations;
  }

  /**
   * Get vulnerability list for enhanced display
   */
  private getVulnerabilityList(results: AnalysisResults): Array<{severity: string, count: number, title: string}> {
    const vulnerabilities: Array<{severity: string, count: number, title: string}> = [];
    
    if (results.summary.critical > 0) {
      vulnerabilities.push({
        severity: 'critical',
        count: results.summary.critical,
        title: 'Critical'
      });
    }
    
    if (results.summary.high > 0) {
      vulnerabilities.push({
        severity: 'high',
        count: results.summary.high,
        title: 'High'
      });
    }
    
    if (results.summary.medium > 0) {
      vulnerabilities.push({
        severity: 'medium',
        count: results.summary.medium,
        title: 'Medium'
      });
    }
    
    if (results.summary.low > 0) {
      vulnerabilities.push({
        severity: 'low',
        count: results.summary.low,
        title: 'Low'
      });
    }

    return vulnerabilities;
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Get text for severity level
   */
  private getSeverityText(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical': return 'Critical';
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      default: return 'Unknown';
    }
  }

  /**
   * Get the highest severity from a list of severities
   */
  private getHighestSeverity(severities: string[]): string {
    const order = ['low', 'medium', 'high', 'critical'];
    
    for (const severity of order.reverse()) {
      if (severities.includes(severity)) {
        return severity;
      }
    }
    
    return 'low';
  }
}

