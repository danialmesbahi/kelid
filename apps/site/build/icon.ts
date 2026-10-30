import { iconPaths, type IconName } from '../../../packages/ui/src/icons';

export function icon(name: string, cls = ''): string {
  const paths = (iconPaths as Record<string, string>)[name as IconName];
  if (!paths) throw new Error(`unknown icon: ${name}`);
  return `<svg class="ic${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}
