import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as NodeServices from "@effect/platform-node/NodeServices";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove("tmp_test_effect_copy", { recursive: true, force: true });
  yield* fs.makeDirectory("tmp_test_effect_copy", { recursive: true });
  yield* fs.copy("apps/desktop/resources", "tmp_test_effect_copy");
  const stat = yield* fs.stat("tmp_test_effect_copy/icon.ico");
  console.log("Effect copy icon.ico size:", stat.size);
  yield* fs.remove("tmp_test_effect_copy", { recursive: true, force: true });
});

program.pipe(Effect.provide(NodeServices.layer), Effect.runPromise);
