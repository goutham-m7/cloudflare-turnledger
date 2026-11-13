"""Record immutable SDK observations in replaylab, then replay with effects forbidden."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "vendor/replaylab-0.1.0-py3-none-any.whl"))
from replaylab import Engine, Store, step  # noqa: E402


def archive(report_path, database_path):
    report = json.loads(Path(report_path).read_text())
    store = Store(database_path)
    engine = Engine(store)
    executing = True

    @step(name="cloudflare.durable-stream.observation", version="1")
    def observation(case_id, seed, index):
        if not executing:
            raise AssertionError("Replay executed an observation boundary")
        run = report["runs"][index]
        assert run["caseId"] == case_id and run["seed"] == seed
        return {key: run[key] for key in ("live", "persisted", "divergence", "postCancelInvocations", "duplicatePersistedChunks")}

    def workflow(schedules):
        return [observation(s["caseId"], s["seed"], index) for index, s in enumerate(schedules)]

    inputs = [{"caseId": run["caseId"], "seed": run["seed"]} for run in report["runs"]]
    recorded = engine.run(workflow, inputs, name="cloudflare-turnledger")
    if store.get_run(recorded)["status"] != "completed":
        raise RuntimeError(store.get_run(recorded)["error"])
    executing = False
    replayed = engine.run(workflow, inputs, mode="replay", source=recorded, name="cloudflare-turnledger")
    if store.get_run(replayed)["status"] != "completed":
        raise RuntimeError(store.get_run(replayed)["error"])
    origins = [row["origin"] for row in store.steps(replayed)]
    if len(origins) != len(inputs) or any(origin != "replayed" for origin in origins):
        raise AssertionError(f"Unexpected replay origins: {origins}")
    return {"recorded": recorded, "replayed": replayed, "observations": len(inputs), "effectsDuringReplay": 0}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: python3 scripts/replaylab_adapter.py report.json replay.sqlite")
    print(json.dumps(archive(sys.argv[1], sys.argv[2])))
