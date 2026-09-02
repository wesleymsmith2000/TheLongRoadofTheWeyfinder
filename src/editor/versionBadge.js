import { BUILD_VERSION } from '../core/buildVersion.js';

export function bindBuildVersion(root = document) {
  for (const element of root.querySelectorAll('[data-build-version]')) {
    element.textContent = BUILD_VERSION;
    element.title = `Runtime checkpoint ${BUILD_VERSION}`;
  }
}
