import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ProjectInfrastructureConfig } from './infrastructure-config.types';
import {workspaceConfig, workspaceRootDir} from './workspace-root-dir';

export const projectsFolderPath = join(workspaceRootDir, 'apps');
export const configFileName = 'infrastructure.config.json';

type ProjectCallback = (args: ProjectCallbackArgs) => Promise<unknown>;

export interface ProjectCallbackArgs {
  projectName: string;
  root: string;
  config: ProjectInfrastructureConfig;
}

async function createStandardProject(
  projectName: string,
  projectDirectory: string,
  createProject: (args: ProjectCallbackArgs) => Promise<void>
) {
  const projectConfigPath = join(
    workspaceRootDir,
    projectDirectory,
    'project.json'
  );
  const projectConfig = JSON.parse(readFileSync(projectConfigPath).toString());

  const { root } = projectConfig;

  const projectFiles = readdirSync(root);
  if (!projectFiles.includes(configFileName)) {
    return;
  }

  const projectInfrastructureConfig = JSON.parse(
    readFileSync(join(root, configFileName)).toString()
  ) as ProjectInfrastructureConfig;

  const duplicates = projectInfrastructureConfig.duplicates ?? 1;
  for (
    let currentDuplicate = 0;
    currentDuplicate < duplicates;
    currentDuplicate++
  ) {
    const duplicateName =
      duplicates > 1 ? `${projectName}-${currentDuplicate}` : projectName;
    await createProject({
      projectName: duplicateName,
      root,
      config: projectInfrastructureConfig,
    });
  }

  for (const virtualProject of projectInfrastructureConfig.virtualProjects ||
    []) {
    const { identifier, config } = virtualProject;
    await createProject({
      projectName: identifier,
      root,
      config,
    });
  }
}

export async function forEachProject(callback: ProjectCallback) {
  const createProject = async (params: ProjectCallbackArgs) => {
    if (params.config.disabled) {
      return;
    }

    await callback(params);
  };

  const projectPromises: Promise<void>[] = [];


  for (const [projectName, projectDirectory] of Object.entries(workspaceConfig.projects)) {
    projectPromises.push(
      createStandardProject(projectName, projectDirectory as string, createProject)
    );
  }

  await Promise.all(projectPromises);
}
