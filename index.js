const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');

/**
 * Vulnify GitHub Action
 * Executes vulnerability scanning using Vulnify CLI
 */

async function run() {
  try {
    // Get inputs
    const file = core.getInput('file');
    const ecosystem = core.getInput('ecosystem');
    const output = core.getInput('output') || 'table';
    const severity = core.getInput('severity');
    const apiKey = core.getInput('api-key');
    const timeout = core.getInput('timeout') || '30000';
    const failOn = core.getInput('fail-on') || 'high';
    const workingDirectory = core.getInput('working-directory') || '.';
    const generateReport = core.getInput('generate-report') === 'true';
    const reportFilename = core.getInput('report-filename') || 'vulnify-report.json';

    core.info('🔍 Starting Vulnify security scan...');
    
    // Change to working directory
    if (workingDirectory !== '.') {
      process.chdir(workingDirectory);
      core.info(`📁 Changed to working directory: ${workingDirectory}`);
    }

    // Install Vulnify CLI globally
    core.info('📦 Installing Vulnify CLI...');
    await exec.exec('npm', ['install', '-g', 'vulnify']);

    // Build command arguments
    const args = ['test'];
    
    if (file) {
      args.push('--file', file);
    }
    
    if (ecosystem) {
      args.push('--ecosystem', ecosystem);
    }
    
    if (severity) {
      args.push('--severity', severity);
    }
    
    if (apiKey) {
      args.push('--api-key', apiKey);
    }
    
    if (timeout) {
      args.push('--timeout', timeout);
    }

    // Always generate JSON output for parsing
    args.push('--output', 'json');
    
    if (!generateReport) {
      args.push('--no-report');
    }

    core.info(`🚀 Running: vulnify ${args.join(' ')}`);

    // Execute Vulnify scan
    let vulnifyOutput = '';
    let vulnifyError = '';
    
    const options = {
      listeners: {
        stdout: (data) => {
          vulnifyOutput += data.toString();
        },
        stderr: (data) => {
          vulnifyError += data.toString();
        }
      },
      ignoreReturnCode: true // Don't fail on non-zero exit codes
    };

    const exitCode = await exec.exec('vulnify', args, options);
    
    // Parse results
    let scanResults = null;
    let reportPath = '';
    
    try {
      // Try to parse JSON output
      if (vulnifyOutput.trim()) {
        const jsonMatch = vulnifyOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          scanResults = JSON.parse(jsonMatch[0]);
        }
      }
      
      // Check for report file
      const possibleReportPaths = [
        reportFilename,
        'vulnify-report.json',
        'report.json'
      ];
      
      for (const reportFile of possibleReportPaths) {
        if (fs.existsSync(reportFile)) {
          reportPath = path.resolve(reportFile);
          if (!scanResults) {
            scanResults = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
          }
          break;
        }
      }
    } catch (parseError) {
      core.warning(`Failed to parse scan results: ${parseError.message}`);
    }

    // Extract metrics
    let totalVulns = 0;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    if (scanResults && scanResults.results && scanResults.results.summary) {
      const summary = scanResults.results.summary;
      criticalCount = summary.critical || 0;
      highCount = summary.high || 0;
      mediumCount = summary.medium || 0;
      lowCount = summary.low || 0;
      totalVulns = criticalCount + highCount + mediumCount + lowCount;
    } else if (scanResults && scanResults.summary) {
      const summary = scanResults.summary;
      criticalCount = summary.critical || 0;
      highCount = summary.high || 0;
      mediumCount = summary.medium || 0;
      lowCount = summary.low || 0;
      totalVulns = criticalCount + highCount + mediumCount + lowCount;
    }

    // Set outputs
    core.setOutput('vulnerabilities-found', totalVulns.toString());
    core.setOutput('critical-count', criticalCount.toString());
    core.setOutput('high-count', highCount.toString());
    core.setOutput('medium-count', mediumCount.toString());
    core.setOutput('low-count', lowCount.toString());
    core.setOutput('report-path', reportPath);

    // Display results in a nice format
    if (output !== 'json') {
      core.info('');
      core.info('📊 Vulnerability Scan Results:');
      core.info('================================');
      core.info(`🔴 Critical: ${criticalCount}`);
      core.info(`🟠 High: ${highCount}`);
      core.info(`🟡 Medium: ${mediumCount}`);
      core.info(`🟢 Low: ${lowCount}`);
      core.info(`📈 Total: ${totalVulns}`);
      core.info('');
    }

    if (reportPath) {
      core.info(`📄 Report generated: ${reportPath}`);
    }

    // Determine if build should fail
    let shouldFail = false;
    let failReason = '';

    switch (failOn.toLowerCase()) {
      case 'critical':
        if (criticalCount > 0) {
          shouldFail = true;
          failReason = `Found ${criticalCount} critical vulnerabilities`;
        }
        break;
      case 'high':
        if (criticalCount > 0 || highCount > 0) {
          shouldFail = true;
          failReason = `Found ${criticalCount} critical and ${highCount} high severity vulnerabilities`;
        }
        break;
      case 'medium':
        if (criticalCount > 0 || highCount > 0 || mediumCount > 0) {
          shouldFail = true;
          failReason = `Found vulnerabilities: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium`;
        }
        break;
      case 'low':
      case 'any':
        if (totalVulns > 0) {
          shouldFail = true;
          failReason = `Found ${totalVulns} vulnerabilities`;
        }
        break;
    }

    if (shouldFail) {
      core.setOutput('scan-result', 'fail');
      core.setFailed(`❌ Security scan failed: ${failReason}`);
    } else {
      core.setOutput('scan-result', 'pass');
      core.info('✅ Security scan passed - no vulnerabilities found above threshold');
    }

    // Handle Vulnify CLI errors
    if (exitCode !== 0 && !shouldFail) {
      if (vulnifyError) {
        core.warning(`Vulnify CLI stderr: ${vulnifyError}`);
      }
      
      // Don't fail if it's just vulnerabilities found
      if (exitCode === 1 && totalVulns > 0) {
        core.info('ℹ️ Vulnify CLI exited with code 1 (vulnerabilities found)');
      } else if (exitCode === 2) {
        core.setFailed(`❌ Vulnify CLI execution error (exit code 2)`);
      } else {
        core.warning(`⚠️ Vulnify CLI exited with code ${exitCode}`);
      }
    }

  } catch (error) {
    core.setFailed(`❌ Action failed: ${error.message}`);
    
    // Provide helpful debugging information
    core.info('');
    core.info('🔧 Debugging Information:');
    core.info('========================');
    core.info(`Working Directory: ${process.cwd()}`);
    core.info(`Node Version: ${process.version}`);
    core.info(`Platform: ${process.platform}`);
    
    // List files in current directory
    try {
      const files = fs.readdirSync('.');
      core.info(`Files in directory: ${files.join(', ')}`);
    } catch (fsError) {
      core.info('Could not list directory files');
    }
  }
}

// Execute the action
if (require.main === module) {
  run();
}

module.exports = { run };

