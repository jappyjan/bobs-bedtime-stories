import {readFileSync} from "fs";
import {join} from "path";

export const workspaceRootDir = process.cwd();

export const workspaceConfig = JSON.parse(
  readFileSync(join(workspaceRootDir, 'workspace.json')).toString()
) as {
  projects: Record<string, string>;
} as any;

interface WorkspaceInfrastructureConfig {
  dynamoDB: {
    tables: Array<{
      identifier: string;
      partitionKey: {
        name: string;
        type: 'STRING' | 'NUMBER' | 'BOOL';
      },
      sortKey?: {
        name: string;
        type: 'STRING' | 'NUMBER' | 'BOOL';
      }
    }>
  };
  secrets: {
    byArn: Record<string, string>;
    generated: string[];
  };
  s3: {
    buckets: Array<{
      identifier: string;
      explicitName?: string;
      websiteIndexDocument?: string;
      websiteErrorDocument?: string;
      publicReadAccess?: boolean;
      cors?: Array<
        {
          "allowedMethods": Array<"GET" | "PUT" | "HEAD" | "POST">;
          "allowedOrigins": Array<string>;
          "allowedHeaders": Array<string>;
        }
      >;
    }>;
  };
  cdn: Array<{
    identifier: string;
    subdomain: string;
    bucketIdentifier: string;
  }>;
}

export const workspaceInfrastructureConfig = JSON.parse(
  readFileSync(join(workspaceRootDir, 'infrastructure.config.json')).toString()
) as WorkspaceInfrastructureConfig;
