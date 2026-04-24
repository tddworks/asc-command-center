import React from 'react';
import * as ReactDom from 'react-dom';
import * as Mobx from 'mobx';
import * as MobxReactLite from 'mobx-react-lite';

import { App } from '../../app-catalog/app/App.ts';
import { AppInfo } from '../../app-catalog/app-info/AppInfo.ts';
import { AppInfoLocalization } from '../../app-catalog/app-info/AppInfoLocalization.ts';
import { Version } from '../../release/version/Version.ts';
import { VersionLocalization } from '../../release/version/VersionLocalization.ts';
import { AgeRatingDeclaration } from '../../app-catalog/age-rating/AgeRatingDeclaration.ts';
import { apiClient } from '../../shared/api-client.tsx';
import { workspace } from '../../workspace/workspaceInstance.ts';

import { pluginRegistry } from './PluginRegistry.ts';
import { PLUGIN_API_VERSION, type PluginAPI, type PluginSettings, type HostUI } from './PluginAPI.ts';

/**
 * Install `window.ascPluginAPI` — the single global plugin scripts see.
 *
 * Called exactly once from `main.tsx` before the React root mounts, so
 * plugin modules dynamic-imported by `PluginBootstrap` can rely on the
 * global being present on first evaluation. Workspace / domain / apiClient
 * handles are live module references (no accessor indirection) — the
 * workspace singleton is already the source of truth.
 */
export interface InstallOptions {
  /** Settings store implementation. Initial cut is a thin stub — real
   *  REST client lands with task #37. */
  settings: PluginSettings;
  /** Host UI primitives. Initial cut is a thin stub — real re-exports
   *  land with task #39. */
  ui: HostUI;
}

declare global {
  interface Window {
    ascPluginAPI: PluginAPI;
  }
}

export function installPluginAPI({ settings, ui }: InstallOptions): PluginAPI {
  const api: PluginAPI = {
    version: PLUGIN_API_VERSION,
    register(registration) {
      pluginRegistry.register(registration);
    },
    host: {
      runtime: {
        react: React,
        reactDom: ReactDom,
        mobx: Mobx,
        mobxReactLite: MobxReactLite,
      },
      domain: {
        App,
        AppInfo,
        AppInfoLocalization,
        Version,
        VersionLocalization,
        AgeRatingDeclaration,
      },
      workspace: {
        workspace,
        currentApp: () => workspace.currentApp,
        selectedVersion: () => workspace.currentApp?.selectedVersion ?? null,
      },
      apiClient: {
        get: (path) => apiClient.get(path),
        post: (path, body) => apiClient.post(path, body),
      },
      settings,
      ui,
    },
  };

  (window as Window).ascPluginAPI = api;
  return api;
}
