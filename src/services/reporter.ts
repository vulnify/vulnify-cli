import * as fs from 'fs-extra';
import * as path from 'path';
import Table from 'cli-table3';
import { AnalysisResults, DependencyAnalysis, Vulnerability } from '../types/api';
import { Report, ReportMetadata, Recommendation } from '../types/cli';
import { colors, formatSeverity, formatCount } from '../utils/colors';
import { logger } from '../utils/logger';

export interface EnhancedDisplayOptions {
  ecosystem?: string;
  projectPath?: string;
  verbose?: boolean;
}

interface GroupedDependency {
  name: string;
  version: string;
  vulnerabilities: Vulnerability[];
  totalVulnerabilities: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  highestSeverity: string;
}

export class ReportGenerator {
  /**
   * IMPROVED: Group dependencies to avoid duplicates and improve visualization
   */
  private groupDependencies(dependencies: DependencyAnalysis[]): GroupedDependency[] {
    const grouped = new Map<string, GroupedDependency>();

    for (const dep of dependencies) {
      const key = `${dep.name}@${dep.version}`;
      
      if (grouped.has(key)) {
        // Merge vulnerabilities for the same package
        const existing = grouped.get(key)!;
        
        // Add new vulnerabilities, avoiding duplicates
        const existingIds = new Set(existing.vulnerabilities.map(v => v.id));
        const newVulns = dep.vulnerabilities.filter(v => !existingIds.has(v.id));
        
        existing.vulnerabilities.push(...newVulns);
        existing.totalVulnerabilities = existing.vulnerabilities.length;
        
        // Recalculate severity counts
        existing.severityCounts = this.calculateSeverityCounts(existing.vulnerabilities);
        existing.highestSeverity = this.getHighestSeverity(existing.vulnerabilities.map(v => v.severity));
      } else {
        // Create new grouped dependency
        const severityCounts = this.calculateSeverityCounts(dep.vulnerabilities);
        
        grouped.set(key, {
          name: dep.name,
          version: dep.version,
          vulnerabilities: [...dep.vulnerabilities],
          totalVulnerabilities: dep.vulnerabilities.length,
          severityCounts,
          highestSeverity: this.getHighestSeverity(dep.vulnerabilities.map(v => v.severity))
        });
      }
    }

    // Sort by highest severity first, then by vulnerability count
    return Array.from(grouped.values()).sort((a, b) => {
      const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const aSeverity = severityOrder[a.highestSeverity as keyof typeof severityOrder] || 0;
      const bSeverity = severityOrder[b.highestSeverity as keyof typeof severityOrder] || 0;
      
      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity; // Higher severity first
      }
      
      return b.totalVulnerabilities - a.totalVulnerabilities; // More vulnerabilities first
    });
  }

  /**
   * Calculate severity counts for vulnerabilities
   */
  private calculateSeverityCounts(vulnerabilities: Vulnerability[]) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    
    for (const vuln of vulnerabilities) {
      const severity = vuln.severity?.toLowerCase();
      if (severity && severity in counts) {
        counts[severity as keyof typeof counts]++;
      }
    }
    
    return counts;
  }

  /**
   * Generate and save JSON report
   */
  async generateJsonReport(
    results: AnalysisResults,
    metadata: Partial<ReportMetadata>,
    outputPath?: string
  ): Promise<string> {
    // Use grouped dependencies for the report
    const groupedDeps = this.groupDependencies(results.dependencies);
    
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
      dependencies: groupedDeps.map(dep => ({
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
   * IMPROVED: Display results in enhanced format with better grouping
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
      const groupedDeps = this.groupDependencies(results.dependencies);
      const affectedPackages = groupedDeps.filter(dep => dep.totalVulnerabilities > 0);
      
      console.log(`⚠️  Found ${results.vulnerabilities_found} vulnerabilities in ${affectedPackages.length} packages:`);
      console.log('');

      // Display summary by severity
      const { summary } = results;
      if (summary.critical > 0) console.log(`🔴 ${summary.critical} Critical`);
      if (summary.high > 0) console.log(`🟠 ${summary.high} High`);
      if (summary.medium > 0) console.log(`🟡 ${summary.medium} Medium`);
      if (summary.low > 0) console.log(`🟢 ${summary.low} Low`);
      
      console.log('');
      console.log(colors.subtitle('📦 Affected Packages:'));
      
      // Show top affected packages
      const topPackages = affectedPackages.slice(0, 10);
      for (const dep of topPackages) {
        const emoji = this.getSeverityEmoji(dep.highestSeverity);
        const severityText = formatSeverity(dep.highestSeverity);
        console.log(`${emoji} ${colors.highlight(dep.name)}@${colors.muted(dep.version)} - ${dep.totalVulnerabilities} vulnerabilities (${severityText})`);
      }
      
      if (affectedPackages.length > 10) {
        console.log(colors.muted(`... and ${affectedPackages.length - 10} more packages`));
      }
    } else {
      console.log('✅ No vulnerabilities found!');
    }

    console.log('');
    console.log(`📄 Report saved to vulnify-report.json`);
  }

  /**
   * IMPROVED: Display results in table format with better grouping
   */
  displayTableResults(results: AnalysisResults): void {
    console.log('');
    console.log(colors.title('📊 Vulnerability Analysis Results'));
    console.log('');

    // Summary
    this.displaySummary(results);

    // Group dependencies to avoid duplicates
    const groupedDeps = this.groupDependencies(results.dependencies);
    const affectedPackages = groupedDeps.filter(dep => dep.totalVulnerabilities > 0);

    if (affectedPackages.length > 0) {
      console.log('');
      console.log(colors.subtitle('🔍 Affected Packages:'));
      console.log('');

      // Package summary table
      const packageTable = new Table({
        head: [
          colors.bold('Package'),
          colors.bold('Version'),
          colors.bold('Vulnerabilities'),
          colors.bold('Highest Severity'),
          colors.bold('Critical'),
          colors.bold('High'),
          colors.bold('Medium'),
          colors.bold('Low')
        ],
        colWidths: [25, 15, 15, 15, 10, 10, 10, 10]
      });

      for (const dep of affectedPackages) {
        packageTable.push([
          colors.highlight(dep.name),
          colors.muted(dep.version),
          colors.warning(dep.totalVulnerabilities.toString()),
          formatSeverity(dep.highestSeverity),
          dep.severityCounts.critical > 0 ? colors.error(dep.severityCounts.critical.toString()) : '0',
          dep.severityCounts.high > 0 ? colors.warning(dep.severityCounts.high.toString()) : '0',
          dep.severityCounts.medium > 0 ? colors.info(dep.severityCounts.medium.toString()) : '0',
          dep.severityCounts.low > 0 ? colors.muted(dep.severityCounts.low.toString()) : '0'
        ]);
      }

      console.log(packageTable.toString());

      // Detailed vulnerabilities table (only for critical and high)
      const criticalAndHigh = affectedPackages.filter(dep => 
        dep.severityCounts.critical > 0 || dep.severityCounts.high > 0
      );

      if (criticalAndHigh.length > 0) {
        console.log('');
        console.log(colors.subtitle('🚨 Critical & High Severity Vulnerabilities:'));
        console.log('');

        const vulnTable = new Table({
          head: [
            colors.bold('Package'),
            colors.bold('CVE/ID'),
            colors.bold('Severity'),
            colors.bold('CVSS'),
            colors.bold('Fixed In'),
            colors.bold('Description')
          ],
          colWidths: [20, 20, 12, 8, 15, 40],
          wordWrap: true
        });

        for (const dep of criticalAndHigh) {
          const criticalHighVulns = dep.vulnerabilities.filter(v => 
            v.severity === 'critical' || v.severity === 'high'
          );

          for (const vuln of criticalHighVulns) {
            vulnTable.push([
              colors.highlight(dep.name),
              vuln.id || 'N/A',
              formatSeverity(vuln.severity),
              (vuln.cvss_score && typeof vuln.cvss_score === 'number') ? vuln.cvss_score.toFixed(1) : 'N/A',
              vuln.fixed_in && vuln.fixed_in.length > 0 ? vuln.fixed_in.join(', ') : colors.muted('No fix available'),
              this.truncateDescription(vuln.description || 'No description available', 100)
            ]);
          }
        }

        console.log(vulnTable.toString());
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
    // Use grouped dependencies for JSON output too
    const groupedDeps = this.groupDependencies(results.dependencies);
    const modifiedResults = {
      ...results,
      dependencies: groupedDeps.map(dep => ({
        name: dep.name,
        version: dep.version,
        vulnerabilities: dep.vulnerabilities
      }))
    };
    
    console.log(JSON.stringify(modifiedResults, null, 2));
  }

  /**
   * IMPROVED: Display results in summary format with better grouping
   */
  displaySummaryResults(results: AnalysisResults): void {
    console.log('');
    console.log(colors.title('📋 Vulnerability Summary'));
    console.log('');

    this.displaySummary(results);

    if (results.vulnerabilities_found > 0) {
      const groupedDeps = this.groupDependencies(results.dependencies);
      const affectedPackages = groupedDeps.filter(dep => dep.totalVulnerabilities > 0);
      
      console.log('');
      console.log(colors.subtitle(`📦 ${affectedPackages.length} Affected Packages:`));
      
      for (const dep of affectedPackages) {
        const severityBreakdown = [];
        if (dep.severityCounts.critical > 0) severityBreakdown.push(`${dep.severityCounts.critical} critical`);
        if (dep.severityCounts.high > 0) severityBreakdown.push(`${dep.severityCounts.high} high`);
        if (dep.severityCounts.medium > 0) severityBreakdown.push(`${dep.severityCounts.medium} medium`);
        if (dep.severityCounts.low > 0) severityBreakdown.push(`${dep.severityCounts.low} low`);
        
        console.log(`  ${formatSeverity(dep.highestSeverity)} ${colors.highlight(dep.name)}@${colors.muted(dep.version)} (${severityBreakdown.join(', ')})`);
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
    const groupedDeps = this.groupDependencies(results.dependencies);
    const affectedPackages = groupedDeps.filter(dep => dep.totalVulnerabilities > 0);
    
    console.log(`${colors.info('📦')} Total Dependencies: ${colors.highlight(results.total_dependencies.toString())}`);
    console.log(`${colors.error('🚨')} Vulnerabilities Found: ${colors.highlight(results.vulnerabilities_found.toString())}`);
    console.log(`${colors.warning('📋')} Affected Packages: ${colors.highlight(affectedPackages.length.toString())}`);
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
    const groupedDeps = this.groupDependencies(results.dependencies);
    const recommendations = this.generateRecommendationsFromGrouped(groupedDeps);
    
    if (recommendations.length > 0) {
      console.log('');
      console.log(colors.subtitle('💡 Recommendations:'));
      console.log('');

      for (const rec of recommendations) {
        switch (rec.type) {
          case 'upgrade':
            console.log(`  ${colors.success('↗')} Upgrade ${colors.highlight(rec.dependency)} from ${colors.muted(rec.current_version)} to ${colors.success(rec.recommended_version || 'latest')}`);
            if (rec.fixes_vulnerabilities.length > 0) {
              console.log(`     Fixes: ${rec.fixes_vulnerabilities.slice(0, 3).join(', ')}${rec.fixes_vulnerabilities.length > 3 ? '...' : ''}`);
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
   * Generate recommendations based on grouped dependencies
   */
  private generateRecommendationsFromGrouped(groupedDeps: GroupedDependency[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const dep of groupedDeps) {
      if (dep.totalVulnerabilities > 0) {
        // Find the best version that fixes vulnerabilities
        const allFixedVersions = dep.vulnerabilities
          .flatMap(v => v.fixed_in || [])
          .filter(Boolean);

        if (allFixedVersions.length > 0) {
          // Get the latest fixed version
          const recommendedVersion = this.getLatestVersion(allFixedVersions);
          
          recommendations.push({
            type: 'upgrade',
            dependency: dep.name,
            current_version: dep.version,
            recommended_version: recommendedVersion,
            fixes_vulnerabilities: dep.vulnerabilities.map(v => v.id)
          });
        } else {
          // No fixed version available
          const hasCriticalOrHigh = dep.severityCounts.critical > 0 || dep.severityCounts.high > 0;

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
   * Generate recommendations based on analysis results (legacy method)
   */
  private generateRecommendations(results: AnalysisResults): Recommendation[] {
    const groupedDeps = this.groupDependencies(results.dependencies);
    return this.generateRecommendationsFromGrouped(groupedDeps);
  }

  /**
   * Get the latest version from a list of versions
   */
  private getLatestVersion(versions: string[]): string {
    // Simple heuristic: return the last version in the array
    // In a real implementation, you might want to use semver comparison
    return versions[versions.length - 1];
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

  /**
   * Truncate description to specified length
   */
  private truncateDescription(description: string, maxLength: number): string {
    if (description.length <= maxLength) {
      return description;
    }
    
    return description.substring(0, maxLength - 3) + '...';
  }
}

