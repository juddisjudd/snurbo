import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname, relative } from "path";
import { Logger } from "@/utils/logger";

export interface KnowledgeEntry {
  path: string;
  relativePath: string;
  content: string;
  type: "markdown" | "text" | "code" | "json";
  size: number;
  lastModified: Date;
  summary?: string;
}

export interface SearchResult {
  entry: KnowledgeEntry;
  relevanceScore: number;
  matchedSections: string[];
}

export class KnowledgeBase {
  private entries: Map<string, KnowledgeEntry> = new Map();
  private logger: Logger;
  private readonly MAX_FILE_SIZE = 1024 * 1024;
  private readonly SUPPORTED_EXTENSIONS = [
    ".md",
    ".txt",
    ".js",
    ".ts",
    ".json",
    ".py",
    ".yaml",
    ".yml",
  ];
  private readonly LKB_PATH = join(process.cwd(), "lkb");

  constructor() {
    this.logger = new Logger({
      service: "snurbo",
      component: "knowledge-base",
    });
    this.indexKnowledgeBase();
  }

  private indexKnowledgeBase(): void {
    if (!existsSync(this.LKB_PATH)) {
      this.logger.warn("LKB directory not found, creating it", {
        path: this.LKB_PATH,
      });
      return;
    }

    try {
      this.scanDirectory(this.LKB_PATH);
      this.logger.info("Knowledge base indexed", {
        totalEntries: this.entries.size,
        path: this.LKB_PATH,
      });
    } catch (error) {
      this.logger.error("Failed to index knowledge base", error, {
        path: this.LKB_PATH,
      });
    }
  }

  private scanDirectory(dirPath: string): void {
    try {
      const items = readdirSync(dirPath);

      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          if (!this.shouldIgnoreDirectory(item)) {
            this.scanDirectory(fullPath);
          }
        } else if (stat.isFile()) {
          this.processFile(fullPath, stat);
        }
      }
    } catch (error) {
      this.logger.warn("Failed to scan directory", {
        dirPath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private shouldIgnoreDirectory(dirName: string): boolean {
    const ignoreDirs = [
      "node_modules",
      ".git",
      ".vscode",
      "dist",
      "build",
      "coverage",
      ".nyc_output",
      "temp",
      ".cache",
    ];
    return ignoreDirs.includes(dirName) || dirName.startsWith(".");
  }

  private processFile(filePath: string, stat: any): void {
    const ext = extname(filePath).toLowerCase();

    if (!this.SUPPORTED_EXTENSIONS.includes(ext)) {
      return;
    }

    if (stat.size > this.MAX_FILE_SIZE) {
      this.logger.warn("File too large, skipping", {
        filePath,
        size: stat.size,
        maxSize: this.MAX_FILE_SIZE,
      });
      return;
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      const relativePath = relative(this.LKB_PATH, filePath);

      const entry: KnowledgeEntry = {
        path: filePath,
        relativePath,
        content,
        type: this.determineFileType(ext),
        size: stat.size,
        lastModified: stat.mtime,
        summary: this.generateSummary(content, ext),
      };

      this.entries.set(relativePath, entry);
    } catch (error) {
      this.logger.warn("Failed to read file", {
        filePath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private determineFileType(ext: string): KnowledgeEntry["type"] {
    switch (ext) {
      case ".md":
        return "markdown";
      case ".json":
        return "json";
      case ".js":
      case ".ts":
      case ".py":
        return "code";
      default:
        return "text";
    }
  }

  private generateSummary(content: string, ext: string): string {
    const lines = content.split("\n").filter((line) => line.trim());

    if (ext === ".md") {
      const title = lines.find((line) => line.startsWith("# "));
      const description = lines.find(
        (line) => !line.startsWith("#") && line.length > 20
      );
      return [title, description].filter(Boolean).join(" - ").substring(0, 200);
    }

    if (ext === ".json") {
      return `JSON file with ${lines.length} lines`;
    }

    if ([".js", ".ts", ".py"].includes(ext)) {
      const comments = lines.filter(
        (line) =>
          line.trim().startsWith("//") ||
          line.trim().startsWith("#") ||
          line.trim().startsWith("/*")
      );
      if (comments.length > 0) {
        return comments[0].substring(0, 200);
      }
    }

    return lines[0]?.substring(0, 200) || "No summary available";
  }

  search(query: string, maxResults: number = 5): SearchResult[] {
    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const [path, entry] of this.entries) {
      const relevanceScore = this.calculateRelevance(entry, queryLower);

      if (relevanceScore > 0) {
        const matchedSections = this.findMatchingSections(
          entry.content,
          queryLower
        );

        results.push({
          entry,
          relevanceScore,
          matchedSections,
        });
      }
    }

    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }

  private calculateRelevance(entry: KnowledgeEntry, query: string): number {
    let score = 0;
    const content = entry.content.toLowerCase();
    const path = entry.relativePath.toLowerCase();
    const summary = entry.summary?.toLowerCase() || "";

    if (path.includes(query)) {
      score += 10;
    }

    if (summary.includes(query)) {
      score += 5;
    }

    const matches = (content.match(new RegExp(query, "gi")) || []).length;
    score += matches;

    if (entry.type === "markdown" && score > 0) {
      score *= 1.2;
    }

    return score;
  }

  private findMatchingSections(content: string, query: string): string[] {
    const sections: string[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes(query)) {
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length - 1, i + 2);
        const section = lines
          .slice(start, end + 1)
          .join("\n")
          .trim();

        if (section.length > 20 && sections.length < 3) {
          sections.push(section.substring(0, 300));
        }
      }
    }

    return sections;
  }

  getEntry(relativePath: string): KnowledgeEntry | null {
    return this.entries.get(relativePath) || null;
  }

  listEntries(): KnowledgeEntry[] {
    return Array.from(this.entries.values());
  }

  refreshIndex(): void {
    this.entries.clear();
    this.indexKnowledgeBase();
  }

  getStats() {
    const typeCount = new Map<string, number>();
    let totalSize = 0;

    for (const entry of this.entries.values()) {
      typeCount.set(entry.type, (typeCount.get(entry.type) || 0) + 1);
      totalSize += entry.size;
    }

    return {
      totalEntries: this.entries.size,
      totalSize,
      typeBreakdown: Object.fromEntries(typeCount),
      lastIndexed: new Date().toISOString(),
    };
  }
}
