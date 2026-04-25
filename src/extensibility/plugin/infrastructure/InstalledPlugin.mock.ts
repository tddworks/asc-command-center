import { InstalledPlugin } from '../InstalledPlugin.ts';
import type { InstalledPluginRepository } from '../InstalledPluginRepository.ts';

/**
 * MockInstalledPluginRepository — fixtures mirror the real shape the asc
 * backend ships (`{ slug, name, apiVersion?, ui }`). Two seed plugins so
 * mock-mode looks meaningful when the user hasn't connected yet.
 */
export class MockInstalledPluginRepository implements InstalledPluginRepository {
  async list(): Promise<InstalledPlugin[]> {
    return [
      new InstalledPlugin({
        slug: 'ASCPro',
        name: 'ASC Pro',
        apiVersion: '1.0.0',
        ui: [
          'ui/ai.bundle.js',
          'ui/simulator.bundle.js',
          'ui/mobile-stream.html',
          'frames/iPhone 17.png',
          'frames/iPhone 17 Pro.png',
        ],
      }),
      new InstalledPlugin({
        slug: 'ScreenshotStudio',
        name: 'Screenshot Studio',
        ui: [
          'ui/studio-shots.js',
          'ui/studio-design.js',
          'ui/studio-export.js',
        ],
      }),
    ];
  }
}
