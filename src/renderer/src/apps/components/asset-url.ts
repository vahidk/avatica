// Resolve relative asset paths in view.html to fetchable URLs.
// Each platform's AppContainer sets __appAssetBase on the container.
// This function just prepends it.

export function resolveAssetUrl(relativePath: string, el: HTMLElement): string {
  if (!relativePath) return relativePath;
  const base = findAssetBase(el);
  return base ? base + relativePath : relativePath;
}

function findAssetBase(el: HTMLElement): string | null {
  let node: HTMLElement | null = el;
  while (node) {
    if ('__appAssetBase' in node) return (node as any).__appAssetBase as string;
    node = node.parentElement;
  }
  return null;
}
