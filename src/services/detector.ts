import * as fs from 'fs-extra';
import * as path from 'path';
import { DetectedFile, Ecosystem, EcosystemConfig } from '../types/cli';
import { logger } from '../utils/logger';

// Configuration for each ecosystem
const ECOSYSTEM_CONFIGS: EcosystemConfig[] = [
  {
    name: 'npm',
    displayName: 'Node.js/npm',
    files: {
      primary: ['package.json'],
      lockfiles: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
      config: ['.npmrc']
    },
    parser: 'npm'
  },
  {
    name: 'pypi',
    displayName: 'Python/PyPI',
    files: {
      primary: ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py'],
      lockfiles: ['Pipfile.lock', 'poetry.lock'],
      config: ['pip.conf', '.pip.conf']
    },
    parser: 'pypi'
  },
  {
    name: 'maven',
    displayName: 'Java/Maven',
    files: {
      primary: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
      lockfiles: ['gradle.lockfile'],
      config: ['gradle.properties', 'settings.gradle']
    },
    parser: 'maven'
  },
  {
    name: 'nuget',
    displayName: '.NET/NuGet',
    files: {
      primary: ['packages.config'],
      lockfiles: ['packages.lock.json'],
      config: ['nuget.config']
    },
    parser: 'nuget'
  },
  {
    name: 'rubygems',
    displayName: 'Ruby/RubyGems',
    files: {
      primary: ['Gemfile'],
      lockfiles: ['Gemfile.lock'],
      config: ['.gemrc']
    },
    parser: 'rubygems'
  },
  {
    name: 'composer',
    displayName: 'PHP/Composer',
    files: {
      primary: ['composer.json'],
      lockfiles: ['composer.lock'],
      config: []
    },
    parser: 'composer'
  },
  {
    name: 'go',
    displayName: 'Go',
    files: {
      primary: ['go.mod'],
      lockfiles: ['go.sum'],
      config: []
    },
    parser: 'go'
  },
  {
    name: 'cargo',
    displayName: 'Rust/Cargo',
    files: {
      primary: ['Cargo.toml'],
      lockfiles: ['Cargo.lock'],
      config: ['.cargo/config.toml']
    },
    parser: 'cargo'
  }
];

export class DependencyDetector {
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = path.resolve(projectPath);
  }

  /**
   * Detect dependency files in the project directory
   */
  async detectFiles(): Promise<DetectedFile[]> {
    const detectedFiles: DetectedFile[] = [];

    logger.debug(`Scanning for dependency files in: ${this.projectPath}`);

    for (const config of ECOSYSTEM_CONFIGS) {
      // Check primary files
      for (const fileName of config.files.primary) {
        const filePath = path.join(this.projectPath, fileName);
        if (await fs.pathExists(filePath)) {
          detectedFiles.push({
            path: filePath,
            ecosystem: config.name,
            confidence: 0.9,
            type: 'primary'
          });
          logger.debug(`Found primary file: ${fileName} (${config.name})`);
        }
      }

      // Check lockfiles
      for (const fileName of config.files.lockfiles) {
        const filePath = path.join(this.projectPath, fileName);
        if (await fs.pathExists(filePath)) {
          detectedFiles.push({
            path: filePath,
            ecosystem: config.name,
            confidence: 0.7,
            type: 'lockfile'
          });
          logger.debug(`Found lockfile: ${fileName} (${config.name})`);
        }
      }

      // Check config files
      for (const fileName of config.files.config) {
        const filePath = path.join(this.projectPath, fileName);
        if (await fs.pathExists(filePath)) {
          detectedFiles.push({
            path: filePath,
            ecosystem: config.name,
            confidence: 0.3,
            type: 'config'
          });
          logger.debug(`Found config file: ${fileName} (${config.name})`);
        }
      }
    }

    // Special handling for .NET projects (scan for *.csproj, *.fsproj, *.vbproj)
    await this.detectDotNetProjects(detectedFiles);

    return this.prioritizeFiles(detectedFiles);
  }

  /**
   * Detect specific file by path
   */
  async detectFile(filePath: string): Promise<DetectedFile | null> {
    const absolutePath = path.resolve(filePath);
    
    if (!await fs.pathExists(absolutePath)) {
      return null;
    }

    const fileName = path.basename(absolutePath);
    const fileExt = path.extname(absolutePath);

    // Check against known patterns
    for (const config of ECOSYSTEM_CONFIGS) {
      // Check primary files
      if (config.files.primary.includes(fileName)) {
        return {
          path: absolutePath,
          ecosystem: config.name,
          confidence: 0.9,
          type: 'primary'
        };
      }

      // Check lockfiles
      if (config.files.lockfiles.includes(fileName)) {
        return {
          path: absolutePath,
          ecosystem: config.name,
          confidence: 0.7,
          type: 'lockfile'
        };
      }

      // Check config files
      if (config.files.config.includes(fileName)) {
        return {
          path: absolutePath,
          ecosystem: config.name,
          confidence: 0.3,
          type: 'config'
        };
      }
    }

    // Special patterns
    if (fileExt === '.csproj' || fileExt === '.fsproj' || fileExt === '.vbproj') {
      return {
        path: absolutePath,
        ecosystem: 'nuget',
        confidence: 0.9,
        type: 'primary'
      };
    }

    // Try content-based detection for unknown files
    return await this.detectByContent(absolutePath);
  }

  /**
   * Get the best file for analysis from detected files
   */
  getBestFile(detectedFiles: DetectedFile[], ecosystem?: Ecosystem): DetectedFile | null {
    if (detectedFiles.length === 0) {
      return null;
    }

    // If ecosystem is specified, filter by it
    let candidates = ecosystem 
      ? detectedFiles.filter(f => f.ecosystem === ecosystem)
      : detectedFiles;

    if (candidates.length === 0) {
      candidates = detectedFiles;
    }

    // Prioritize by type and confidence
    candidates.sort((a, b) => {
      // Primary files first
      if (a.type === 'primary' && b.type !== 'primary') return -1;
      if (b.type === 'primary' && a.type !== 'primary') return 1;
      
      // Then by confidence
      return b.confidence - a.confidence;
    });

    return candidates[0];
  }

  /**
   * Detect .NET project files
   */
  private async detectDotNetProjects(detectedFiles: DetectedFile[]): Promise<void> {
    try {
      const files = await fs.readdir(this.projectPath);
      
      for (const file of files) {
        const ext = path.extname(file);
        if (['.csproj', '.fsproj', '.vbproj'].includes(ext)) {
          const filePath = path.join(this.projectPath, file);
          detectedFiles.push({
            path: filePath,
            ecosystem: 'nuget',
            confidence: 0.9,
            type: 'primary'
          });
          logger.debug(`Found .NET project file: ${file}`);
        }
      }
    } catch (error) {
      logger.debug('Error scanning for .NET projects:', error);
    }
  }

  /**
   * Detect ecosystem by file content
   */
  private async detectByContent(filePath: string): Promise<DetectedFile | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);

      // Content-based detection patterns
      const patterns = [
        { ecosystem: 'npm', pattern: /"dependencies":|"devDependencies":|"scripts":/, confidence: 0.8 },
        { ecosystem: 'pypi', pattern: /^[a-zA-Z0-9\-_.]+[>=<~!]=/, confidence: 0.7 },
        { ecosystem: 'maven', pattern: /<dependencies>|<groupId>|<artifactId>/, confidence: 0.8 },
        { ecosystem: 'nuget', pattern: /<PackageReference|<package id=/, confidence: 0.8 },
        { ecosystem: 'rubygems', pattern: /gem ['"][a-zA-Z0-9\-_.]+['"]/, confidence: 0.7 },
        { ecosystem: 'composer', pattern: /"require":|"require-dev":/, confidence: 0.8 },
        { ecosystem: 'go', pattern: /module |require |go \d+\.\d+/, confidence: 0.8 },
        { ecosystem: 'cargo', pattern: /\[dependencies\]|\[dev-dependencies\]/, confidence: 0.8 }
      ];

      for (const { ecosystem, pattern, confidence } of patterns) {
        if (pattern.test(content)) {
          return {
            path: filePath,
            ecosystem: ecosystem as Ecosystem,
            confidence,
            type: 'primary'
          };
        }
      }

    } catch (error) {
      logger.debug(`Error reading file for content detection: ${filePath}`, error);
    }

    return null;
  }

  /**
   * Prioritize detected files by relevance
   */
  private prioritizeFiles(files: DetectedFile[]): DetectedFile[] {
    return files.sort((a, b) => {
      // Primary files first
      if (a.type === 'primary' && b.type !== 'primary') return -1;
      if (b.type === 'primary' && a.type !== 'primary') return 1;
      
      // Then by confidence
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      
      // Then by ecosystem preference (npm, pypi, maven, etc.)
      const ecosystemPriority = ['npm', 'pypi', 'maven', 'nuget', 'rubygems', 'composer', 'go', 'cargo'];
      const aIndex = ecosystemPriority.indexOf(a.ecosystem);
      const bIndex = ecosystemPriority.indexOf(b.ecosystem);
      
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  }
}

