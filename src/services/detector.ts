import * as fs from 'fs-extra';
import * as path from 'path';
import { DetectedFile, Ecosystem, EcosystemConfig, ProjectStructure } from '../types/cli';
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

// Directories to ignore during recursive search
const IGNORE_DIRECTORIES = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'target',
  'bin',
  'obj',
  '__pycache__',
  '.pytest_cache',
  'venv',
  'env',
  '.env',
  '.vscode',
  '.idea',
  'coverage',
  '.nyc_output',
  'logs',
  'tmp',
  'temp'
];

export class DependencyDetector {
  private projectPath: string;
  private maxDepth: number;

  constructor(projectPath: string = process.cwd(), maxDepth: number = 3) {
    this.projectPath = path.resolve(projectPath);
    this.maxDepth = maxDepth;
  }

  /**
   * Detect dependency files in the project directory with recursive search
   */
  async detectFiles(): Promise<DetectedFile[]> {
    const detectedFiles: DetectedFile[] = [];

    logger.debug(`Scanning for dependency files in: ${this.projectPath} (max depth: ${this.maxDepth})`);

    // First, try current directory (highest priority)
    await this.scanDirectory(this.projectPath, detectedFiles, 0);

    // If no files found in current directory, search recursively
    if (detectedFiles.length === 0) {
      logger.info('No dependency files found in current directory, searching subdirectories...');
      await this.scanDirectoryRecursive(this.projectPath, detectedFiles, 1);
    }

    // Special handling for .NET projects
    await this.detectDotNetProjects(detectedFiles);

    // Detect project structure for better analysis
    const projectStructure = await this.detectProjectStructure(detectedFiles);
    if (projectStructure.isMonorepo) {
      logger.info(`Detected monorepo structure with ${projectStructure.subprojects.length} subprojects`);
    }

    return this.prioritizeFiles(detectedFiles);
  }

  /**
   * Recursive directory scanning with depth limit
   */
  private async scanDirectoryRecursive(
    dirPath: string, 
    detectedFiles: DetectedFile[], 
    currentDepth: number
  ): Promise<void> {
    if (currentDepth > this.maxDepth) {
      return;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(dirPath, entry.name);
          
          // Skip ignored directories
          if (IGNORE_DIRECTORIES.includes(entry.name)) {
            continue;
          }

          // Scan subdirectory
          await this.scanDirectory(subDirPath, detectedFiles, currentDepth);
          
          // Continue recursive search
          await this.scanDirectoryRecursive(subDirPath, detectedFiles, currentDepth + 1);
        }
      }
    } catch (error) {
      logger.debug(`Error scanning directory ${dirPath}:`, error);
    }
  }

  /**
   * Scan a single directory for dependency files
   */
  private async scanDirectory(
    dirPath: string, 
    detectedFiles: DetectedFile[], 
    depth: number
  ): Promise<void> {
    for (const config of ECOSYSTEM_CONFIGS) {
      // Check primary files
      for (const fileName of config.files.primary) {
        const filePath = path.join(dirPath, fileName);
        if (await fs.pathExists(filePath)) {
          detectedFiles.push({
            path: filePath,
            ecosystem: config.name,
            confidence: depth === 0 ? 0.9 : Math.max(0.5, 0.9 - (depth * 0.2)),
            type: 'primary'
          });
          logger.debug(`Found primary file: ${fileName} (${config.name}) at depth ${depth}`);
        }
      }

      // Check lockfiles
      for (const fileName of config.files.lockfiles) {
        const filePath = path.join(dirPath, fileName);
        if (await fs.pathExists(filePath)) {
          detectedFiles.push({
            path: filePath,
            ecosystem: config.name,
            confidence: depth === 0 ? 0.7 : Math.max(0.3, 0.7 - (depth * 0.2)),
            type: 'lockfile'
          });
          logger.debug(`Found lockfile: ${fileName} (${config.name}) at depth ${depth}`);
        }
      }

      // Check config files
      for (const fileName of config.files.config) {
        const filePath = path.join(dirPath, fileName);
        if (await fs.pathExists(filePath)) {
          detectedFiles.push({
            path: filePath,
            ecosystem: config.name,
            confidence: depth === 0 ? 0.3 : Math.max(0.1, 0.3 - (depth * 0.1)),
            type: 'config'
          });
          logger.debug(`Found config file: ${fileName} (${config.name}) at depth ${depth}`);
        }
      }
    }
  }

  /**
   * Detect specific file by path with enhanced validation
   */
  async detectFile(filePath: string): Promise<DetectedFile | null> {
    const absolutePath = path.resolve(filePath);
    
    if (!await fs.pathExists(absolutePath)) {
      throw new Error(`File not found: ${filePath}`);
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
   * Get the best file for analysis from detected files with enhanced logic
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

    // Prioritize by type, confidence, and path depth
    candidates.sort((a, b) => {
      // Primary files first
      if (a.type === 'primary' && b.type !== 'primary') return -1;
      if (b.type === 'primary' && a.type !== 'primary') return 1;
      
      // Then by confidence
      if (Math.abs(a.confidence - b.confidence) > 0.1) {
        return b.confidence - a.confidence;
      }
      
      // Prefer files closer to project root
      const aDepth = a.path.split(path.sep).length;
      const bDepth = b.path.split(path.sep).length;
      if (aDepth !== bDepth) {
        return aDepth - bDepth;
      }
      
      // Then by ecosystem preference
      const ecosystemPriority = ['npm', 'pypi', 'maven', 'nuget', 'rubygems', 'composer', 'go', 'cargo'];
      const aIndex = ecosystemPriority.indexOf(a.ecosystem);
      const bIndex = ecosystemPriority.indexOf(b.ecosystem);
      
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    return candidates[0];
  }

  /**
   * Detect project structure and identify monorepos
   */
  private async detectProjectStructure(detectedFiles: DetectedFile[]): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      isMonorepo: false,
      rootEcosystem: null,
      subprojects: [],
      totalFiles: detectedFiles.length
    };

    // Group files by directory
    const filesByDir = new Map<string, DetectedFile[]>();
    
    for (const file of detectedFiles) {
      const dir = path.dirname(file.path);
      if (!filesByDir.has(dir)) {
        filesByDir.set(dir, []);
      }
      filesByDir.get(dir)!.push(file);
    }

    // Detect monorepo if multiple directories have primary files
    const dirsWithPrimary = Array.from(filesByDir.entries())
      .filter(([_, files]) => files.some(f => f.type === 'primary'));

    if (dirsWithPrimary.length > 1) {
      structure.isMonorepo = true;
      structure.subprojects = dirsWithPrimary.map(([dir, files]) => ({
        path: dir,
        ecosystem: files.find(f => f.type === 'primary')?.ecosystem || 'unknown',
        files: files.length
      }));
    }

    // Determine root ecosystem
    const rootFiles = filesByDir.get(this.projectPath) || [];
    const rootPrimary = rootFiles.find(f => f.type === 'primary');
    if (rootPrimary) {
      structure.rootEcosystem = rootPrimary.ecosystem;
    }

    return structure;
  }

  /**
   * Detect .NET project files with improved scanning
   */
  private async detectDotNetProjects(detectedFiles: DetectedFile[]): Promise<void> {
    try {
      await this.scanForDotNetFiles(this.projectPath, detectedFiles, 0);
    } catch (error) {
      logger.debug('Error scanning for .NET projects:', error);
    }
  }

  /**
   * Recursively scan for .NET project files
   */
  private async scanForDotNetFiles(
    dirPath: string, 
    detectedFiles: DetectedFile[], 
    depth: number
  ): Promise<void> {
    if (depth > this.maxDepth) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (['.csproj', '.fsproj', '.vbproj', '.sln'].includes(ext)) {
            const filePath = path.join(dirPath, entry.name);
            detectedFiles.push({
              path: filePath,
              ecosystem: 'nuget',
              confidence: ext === '.sln' ? 0.8 : 0.9,
              type: 'primary'
            });
            logger.debug(`Found .NET project file: ${entry.name}`);
          }
        } else if (entry.isDirectory() && !IGNORE_DIRECTORIES.includes(entry.name)) {
          await this.scanForDotNetFiles(
            path.join(dirPath, entry.name), 
            detectedFiles, 
            depth + 1
          );
        }
      }
    } catch (error) {
      logger.debug(`Error scanning directory for .NET files: ${dirPath}`, error);
    }
  }

  /**
   * Detect ecosystem by file content with improved patterns
   */
  private async detectByContent(filePath: string): Promise<DetectedFile | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);

      // Enhanced content-based detection patterns
      const patterns = [
        { 
          ecosystem: 'npm', 
          pattern: /"dependencies":|"devDependencies":|"scripts":|"name":\s*"[^"]+"|"version":\s*"[^"]+"/, 
          confidence: 0.8 
        },
        { 
          ecosystem: 'pypi', 
          pattern: /^[a-zA-Z0-9\-_.]+[>=<~!]=|^-r\s+|^--requirement\s+|^pip\s+install/, 
          confidence: 0.7 
        },
        { 
          ecosystem: 'maven', 
          pattern: /<dependencies>|<groupId>|<artifactId>|<version>.*<\/version>|<project.*xmlns/, 
          confidence: 0.8 
        },
        { 
          ecosystem: 'nuget', 
          pattern: /<PackageReference|<package\s+id=|<Project\s+Sdk=/, 
          confidence: 0.8 
        },
        { 
          ecosystem: 'rubygems', 
          pattern: /gem\s+['"][a-zA-Z0-9\-_.]+['"]|source\s+['"]https:\/\/rubygems\.org['"]/, 
          confidence: 0.7 
        },
        { 
          ecosystem: 'composer', 
          pattern: /"require":|"require-dev":|"autoload":|"psr-4":/, 
          confidence: 0.8 
        },
        { 
          ecosystem: 'go', 
          pattern: /module\s+[a-zA-Z0-9\-_.\/]+|require\s+[a-zA-Z0-9\-_.\/]+|go\s+\d+\.\d+/, 
          confidence: 0.8 
        },
        { 
          ecosystem: 'cargo', 
          pattern: /\[dependencies\]|\[dev-dependencies\]|\[package\]|name\s*=\s*"[^"]+"/, 
          confidence: 0.8 
        }
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
   * Prioritize detected files by relevance with enhanced logic
   */
  private prioritizeFiles(files: DetectedFile[]): DetectedFile[] {
    return files.sort((a, b) => {
      // Primary files first
      if (a.type === 'primary' && b.type !== 'primary') return -1;
      if (b.type === 'primary' && a.type !== 'primary') return 1;
      
      // Then by confidence
      if (Math.abs(a.confidence - b.confidence) > 0.05) {
        return b.confidence - a.confidence;
      }
      
      // Prefer files closer to project root
      const aDepth = a.path.split(path.sep).length;
      const bDepth = b.path.split(path.sep).length;
      if (aDepth !== bDepth) {
        return aDepth - bDepth;
      }
      
      // Then by ecosystem preference
      const ecosystemPriority = ['npm', 'pypi', 'maven', 'nuget', 'rubygems', 'composer', 'go', 'cargo'];
      const aIndex = ecosystemPriority.indexOf(a.ecosystem);
      const bIndex = ecosystemPriority.indexOf(b.ecosystem);
      
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  }

  /**
   * Validate ecosystem compatibility
   */
  validateEcosystem(ecosystem: string): boolean {
    return ECOSYSTEM_CONFIGS.some(config => config.name === ecosystem);
  }

  /**
   * Get supported ecosystems
   */
  getSupportedEcosystems(): string[] {
    return ECOSYSTEM_CONFIGS.map(config => config.name);
  }

  /**
   * Get ecosystem display name
   */
  getEcosystemDisplayName(ecosystem: string): string {
    const config = ECOSYSTEM_CONFIGS.find(c => c.name === ecosystem);
    return config?.displayName || ecosystem;
  }
}

