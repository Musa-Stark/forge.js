import { ConfigurationError } from "../errors/index.js";
import type { DataSource, ModelDefinition, Repository } from "../data/Repository.js";
import { InMemoryRepository } from "./InMemoryRepository.js";

/** A {@link DataSource} that keeps everything in memory. Use it to test an app without MongoDB. */
export class InMemoryDataSource implements DataSource {
  private readonly repos = new Map<string, InMemoryRepository>();
  /** Set to `false` to simulate a database outage in health checks. */
  healthy = true;

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  register(definition: ModelDefinition): Repository {
    const existing = this.repos.get(definition.name);
    if (existing) return existing;
    const repo = new InMemoryRepository(definition.name, definition, (name) => this.repos.get(name));
    this.repos.set(definition.name, repo);
    return repo;
  }

  repository(modelName: string): InMemoryRepository {
    const repo = this.repos.get(modelName);
    if (!repo) throw new ConfigurationError({ message: `Model '${modelName}' is not registered.` });
    return repo;
  }

  has(modelName: string): boolean {
    return this.repos.has(modelName);
  }

  async ping(): Promise<boolean> {
    return this.healthy;
  }
}
