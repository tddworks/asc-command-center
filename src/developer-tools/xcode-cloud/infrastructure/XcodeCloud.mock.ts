import { CiProduct } from '../CiProduct.ts';
import { CiWorkflow } from '../CiWorkflow.ts';

export function mockProducts(): CiProduct[] {
  return [
    new CiProduct('p-1', 'My App', 'APP', 'app-1', {
      listWorkflows: 'asc xcode-cloud workflows list --product-id p-1',
    }),
    new CiProduct('p-2', 'Shared Framework', 'FRAMEWORK', undefined, {
      listWorkflows: 'asc xcode-cloud workflows list --product-id p-2',
    }),
    new CiProduct('p-3', 'Widget Extension', 'APP_EXTENSION', 'app-1', {}),
  ];
}

export function mockWorkflows(productId: string): CiWorkflow[] {
  return [
    new CiWorkflow('w-1', productId, 'Release', true, false, {
      startBuild: `asc xcode-cloud build-runs start --workflow-id w-1`,
      listBuildRuns: `asc xcode-cloud build-runs list --workflow-id w-1`,
    }),
    new CiWorkflow('w-2', productId, 'Nightly Tests', true, false, {
      startBuild: `asc xcode-cloud build-runs start --workflow-id w-2`,
      listBuildRuns: `asc xcode-cloud build-runs list --workflow-id w-2`,
    }),
    new CiWorkflow('w-3', productId, 'PR Check', true, true, {
      listBuildRuns: `asc xcode-cloud build-runs list --workflow-id w-3`,
    }),
    new CiWorkflow('w-4', productId, 'Deprecated Flow', false, false, {}),
  ];
}
