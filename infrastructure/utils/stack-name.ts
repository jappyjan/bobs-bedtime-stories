export function getStackName(
  appType: 'frontend' | 'backend' | 'shared',
) {
  switch (appType) {
    case 'frontend':
      return `Frontend`;

    case 'backend':
      return `Backend`;

    case 'shared':
      return `Shared`;

    default:
      throw new Error(`Unknown App Type ${appType}`);
  }
}
