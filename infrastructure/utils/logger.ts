export type ProjectLogger = (...msg: unknown[]) => void;

export function makeProjectLogger(projectName: string): ProjectLogger {
  return (...msg: unknown[]) => console.debug(`${projectName} >> `, ...msg);
}
