/**
 * GhostCodeDriver â€” `ProviderDriver` for the GhostCode runtime.
 *
 * GhostCode is an edited version of OpenCode that uses the same protocol
 * (`@opencode-ai/sdk/v2`) but with the `ghostcode` binary. This driver
 * reuses all OpenCode internals (adapter, provider layer, text generation,
 * runtime) and only changes the presented driver kind, display name, and
 * default binary path.
 *
 * @module provider/Drivers/GhostCodeDriver
 */
import { GhostCodeSettings, ProviderDriverKind, type ServerProvider } from "@ghostforge/contracts";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { HttpClient } from "effect/unstable/http";
import { ChildProcessSpawner } from "effect/unstable/process";

import { makeOpenCodeTextGeneration } from "../../textGeneration/OpenCodeTextGeneration.ts";
import { ServerConfig } from "../../config.ts";
import { ProviderDriverError } from "../Errors.ts";
import { makeOpenCodeAdapter } from "../Layers/OpenCodeAdapter.ts";
import {
  checkOpenCodeProviderStatus,
  makePendingOpenCodeProvider,
} from "../Layers/OpenCodeProvider.ts";
import { ProviderEventLoggers } from "../Layers/ProviderEventLoggers.ts";
import { makeManagedServerProvider } from "../makeManagedServerProvider.ts";
import { OpenCodeRuntime } from "../opencodeRuntime.ts";
import {
  defaultProviderContinuationIdentity,
  type ProviderDriver,
  type ProviderInstance,
} from "../ProviderDriver.ts";
import type { ServerProviderDraft } from "../providerSnapshot.ts";
import { mergeProviderInstanceEnvironment } from "../ProviderInstanceEnvironment.ts";
import {
  enrichProviderSnapshotWithVersionAdvisory,
  makeProviderMaintenanceCapabilities,
  makeStaticProviderMaintenanceResolver,
  resolveProviderMaintenanceCapabilitiesEffect,
} from "../providerMaintenance.ts";
const decodeGhostCodeSettings = Schema.decodeSync(GhostCodeSettings);

const DRIVER_KIND = ProviderDriverKind.make("ghostcode");
const SNAPSHOT_REFRESH_INTERVAL = Duration.minutes(5);

const UPDATE = makeStaticProviderMaintenanceResolver(
  makeProviderMaintenanceCapabilities({
    provider: DRIVER_KIND,
    packageName: null,
    updateExecutable: "ghostcode",
    updateArgs: ["upgrade"],
    updateLockKey: "ghostcode-native",
  }),
);

export type GhostCodeDriverEnv =
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | HttpClient.HttpClient
  | OpenCodeRuntime
  | Path.Path
  | ProviderEventLoggers
  | ServerConfig;

const withInstanceIdentity =
  (input: {
    readonly instanceId: ProviderInstance["instanceId"];
    readonly displayName: string | undefined;
    readonly accentColor: string | undefined;
    readonly continuationGroupKey: string;
  }) =>
  (snapshot: ServerProviderDraft): ServerProvider => ({
    ...snapshot,
    instanceId: input.instanceId,
    driver: DRIVER_KIND,
    ...(input.displayName ? { displayName: input.displayName } : {}),
    ...(input.accentColor ? { accentColor: input.accentColor } : {}),
    continuation: { groupKey: input.continuationGroupKey },
  });

export const GhostCodeDriver: ProviderDriver<GhostCodeSettings, GhostCodeDriverEnv> = {
  driverKind: DRIVER_KIND,
  metadata: {
    displayName: "GhostCode",
    supportsMultipleInstances: true,
  },
  configSchema: GhostCodeSettings,
  defaultConfig: (): GhostCodeSettings => decodeGhostCodeSettings({}),
  create: ({ instanceId, displayName, accentColor, environment, enabled, config }) =>
    Effect.gen(function* () {
      const openCodeRuntime = yield* OpenCodeRuntime;
      const serverConfig = yield* ServerConfig;
      const httpClient = yield* HttpClient.HttpClient;
      const eventLoggers = yield* ProviderEventLoggers;
      const processEnv = mergeProviderInstanceEnvironment(environment);
      const continuationIdentity = defaultProviderContinuationIdentity({
        driverKind: DRIVER_KIND,
        instanceId,
      });
      const stampIdentity = withInstanceIdentity({
        instanceId,
        displayName,
        accentColor,
        continuationGroupKey: continuationIdentity.continuationKey,
      });
      const effectiveConfig = { ...config, enabled } satisfies GhostCodeSettings;
      const maintenanceCapabilities = yield* resolveProviderMaintenanceCapabilitiesEffect(UPDATE, {
        binaryPath: effectiveConfig.binaryPath,
        env: processEnv,
      });

      const adapter = yield* makeOpenCodeAdapter(effectiveConfig, {
        instanceId,
        driverKind: DRIVER_KIND,
        environment: processEnv,
        ...(eventLoggers.native ? { nativeEventLogger: eventLoggers.native } : {}),
      });
      const textGeneration = yield* makeOpenCodeTextGeneration(
        effectiveConfig,
        processEnv,
        "ghostcode",
      );

      const checkProvider = checkOpenCodeProviderStatus(
        effectiveConfig,
        serverConfig.cwd,
        processEnv,
        { skipVersionCheck: true, label: "GhostCode", commandName: "ghostcode" },
      ).pipe(Effect.map(stampIdentity), Effect.provideService(OpenCodeRuntime, openCodeRuntime));

      const snapshot = yield* makeManagedServerProvider<GhostCodeSettings>({
        maintenanceCapabilities,
        getSettings: Effect.succeed(effectiveConfig),
        streamSettings: Stream.never,
        haveSettingsChanged: () => false,
        initialSnapshot: (settings) =>
          makePendingOpenCodeProvider(settings, { label: "GhostCode" }).pipe(
            Effect.map(stampIdentity),
          ),
        checkProvider,
        enrichSnapshot: ({ snapshot, publishSnapshot }) =>
          enrichProviderSnapshotWithVersionAdvisory(snapshot, maintenanceCapabilities).pipe(
            Effect.provideService(HttpClient.HttpClient, httpClient),
            Effect.flatMap((enrichedSnapshot) => publishSnapshot(enrichedSnapshot)),
          ),
        refreshInterval: SNAPSHOT_REFRESH_INTERVAL,
      }).pipe(
        Effect.mapError(
          (cause) =>
            new ProviderDriverError({
              driver: DRIVER_KIND,
              instanceId,
              detail: `Failed to build GhostCode snapshot: ${cause.message ?? String(cause)}`,
              cause,
            }),
        ),
      );

      return {
        instanceId,
        driverKind: DRIVER_KIND,
        continuationIdentity,
        displayName,
        accentColor,
        enabled,
        snapshot,
        adapter,
        textGeneration,
      } satisfies ProviderInstance;
    }),
};
