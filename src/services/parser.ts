import * as fs from 'fs-extra';
import * as path from 'path';
import { Dependency } from '../types/api';
import { ParsedDependencies, Ecosystem } from '../types/cli';
import { logger } from '../utils/logger';

export class DependencyParser {
  /**
   * Parse dependencies from a file
   */
  async parseFile(filePath: string, ecosystem: Ecosystem): Promise<ParsedDependencies> {
    const absolutePath = path.resolve(filePath);
    
    if (!await fs.pathExists(absolutePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await fs.readFile(absolutePath, 'utf-8');
    const dependencies = await this.parseContent(content, ecosystem);

    return {
      ecosystem,
      dependencies,
      source_file: absolutePath
    };
  }

  /**
   * Parse dependencies from content string
   */
  async parseContent(content: string, ecosystem: Ecosystem): Promise<Dependency[]> {
    logger.debug(`Parsing dependencies for ecosystem: ${ecosystem}`);

    switch (ecosystem) {
      case 'npm':
        return this.parseNpm(content);
      case 'pypi':
        return this.parsePypi(content);
      case 'maven':
        return this.parseMaven(content);
      case 'nuget':
        return this.parseNuget(content);
      case 'rubygems':
        return this.parseRubygems(content);
      case 'composer':
        return this.parseComposer(content);
      case 'go':
        return this.parseGo(content);
      case 'cargo':
        return this.parseCargo(content);
      default:
        throw new Error(`Unsupported ecosystem: ${ecosystem}`);
    }
  }

  /**
   * Parse npm package.json
   */
  private parseNpm(content: string): Dependency[] {
    try {
      const packageJson = JSON.parse(content);
      const dependencies: Dependency[] = [];

      // Parse dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          dependencies.push({
            name,
            version: this.cleanVersion(version as string)
          });
        }
      }

      // Parse devDependencies
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          dependencies.push({
            name,
            version: this.cleanVersion(version as string)
          });
        }
      }

      return dependencies;
    } catch (error) {
      throw new Error(`Failed to parse package.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse Python requirements.txt
   */
  private parsePypi(content: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
        continue;
      }

      // Parse requirement line (package==version, package>=version, etc.)
      const match = trimmed.match(/^([a-zA-Z0-9\-_.]+)([>=<~!]+)([0-9a-zA-Z\-_.]+)/);
      if (match) {
        const [, name, , version] = match;
        dependencies.push({
          name: name.toLowerCase(),
          version: this.cleanVersion(version)
        });
      } else {
        // Simple package name without version
        const simpleMatch = trimmed.match(/^([a-zA-Z0-9\-_.]+)$/);
        if (simpleMatch) {
          dependencies.push({
            name: simpleMatch[1].toLowerCase(),
            version: 'latest'
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * Parse Maven pom.xml
   */
  private parseMaven(content: string): Dependency[] {
    const dependencies: Dependency[] = [];
    
    // Simple regex-based parsing for Maven dependencies
    const dependencyRegex = /<dependency>[\s\S]*?<groupId>(.*?)<\/groupId>[\s\S]*?<artifactId>(.*?)<\/artifactId>[\s\S]*?<version>(.*?)<\/version>[\s\S]*?<\/dependency>/g;
    
    let match;
    while ((match = dependencyRegex.exec(content)) !== null) {
      const [, groupId, artifactId, version] = match;
      dependencies.push({
        name: `${groupId.trim()}:${artifactId.trim()}`,
        version: this.cleanVersion(version.trim())
      });
    }

    return dependencies;
  }

  /**
   * Parse .NET packages.config or .csproj
   */
  private parseNuget(content: string): Dependency[] {
    const dependencies: Dependency[] = [];

    // Parse packages.config format
    const packagesConfigRegex = /<package id="([^"]+)" version="([^"]+)"/g;
    let match;
    while ((match = packagesConfigRegex.exec(content)) !== null) {
      const [, name, version] = match;
      dependencies.push({
        name: name.trim(),
        version: this.cleanVersion(version.trim())
      });
    }

    // Parse .csproj PackageReference format
    const packageRefRegex = /<PackageReference Include="([^"]+)" Version="([^"]+)"/g;
    while ((match = packageRefRegex.exec(content)) !== null) {
      const [, name, version] = match;
      dependencies.push({
        name: name.trim(),
        version: this.cleanVersion(version.trim())
      });
    }

    return dependencies;
  }

  /**
   * Parse Ruby Gemfile
   */
  private parseRubygems(content: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse gem lines: gem 'name', 'version' or gem "name", "version"
      const gemMatch = trimmed.match(/gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?/);
      if (gemMatch) {
        const [, name, version] = gemMatch;
        dependencies.push({
          name: name.trim(),
          version: version ? this.cleanVersion(version.trim()) : 'latest'
        });
      }
    }

    return dependencies;
  }

  /**
   * Parse PHP composer.json
   */
  private parseComposer(content: string): Dependency[] {
    try {
      const composerJson = JSON.parse(content);
      const dependencies: Dependency[] = [];

      // Parse require
      if (composerJson.require) {
        for (const [name, version] of Object.entries(composerJson.require)) {
          // Skip PHP version requirement
          if (name !== 'php') {
            dependencies.push({
              name,
              version: this.cleanVersion(version as string)
            });
          }
        }
      }

      // Parse require-dev
      if (composerJson['require-dev']) {
        for (const [name, version] of Object.entries(composerJson['require-dev'])) {
          dependencies.push({
            name,
            version: this.cleanVersion(version as string)
          });
        }
      }

      return dependencies;
    } catch (error) {
      throw new Error(`Failed to parse composer.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse Go go.mod
   */
  private parseGo(content: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');
    let inRequireBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//')) {
        continue;
      }

      // Check for require block
      if (trimmed === 'require (') {
        inRequireBlock = true;
        continue;
      }

      if (trimmed === ')' && inRequireBlock) {
        inRequireBlock = false;
        continue;
      }

      // Parse require lines
      if (inRequireBlock || trimmed.startsWith('require ')) {
        const requireMatch = trimmed.match(/(?:require\s+)?([^\s]+)\s+([^\s]+)/);
        if (requireMatch) {
          const [, name, version] = requireMatch;
          dependencies.push({
            name: name.trim(),
            version: this.cleanVersion(version.trim())
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * Parse Rust Cargo.toml
   */
  private parseCargo(content: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');
    let inDependenciesSection = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Check for sections
      if (trimmed.startsWith('[')) {
        inDependenciesSection = trimmed === '[dependencies]' || trimmed === '[dev-dependencies]';
        continue;
      }

      // Parse dependency lines in dependencies section
      if (inDependenciesSection) {
        const depMatch = trimmed.match(/^([^=\s]+)\s*=\s*"([^"]+)"/);
        if (depMatch) {
          const [, name, version] = depMatch;
          dependencies.push({
            name: name.trim(),
            version: this.cleanVersion(version.trim())
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * Clean version string by removing prefixes and ranges
   */
  private cleanVersion(version: string): string {
    // Remove common prefixes and operators
    return version
      .replace(/^[\^~>=<]+/, '')  // Remove ^, ~, >=, <=, etc.
      .replace(/\s*\|\|.*$/, '')  // Remove OR conditions
      .trim();
  }
}

