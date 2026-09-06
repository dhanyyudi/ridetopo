import { describe, it, expect, vi } from "vitest";
import { reloadOnWorkerReplacement } from "@/lib/service-worker-reload";

/** Just enough of ServiceWorkerContainer to fire controllerchange. */
function fakeContainer(controller: unknown) {
  const listeners: Array<() => void> = [];
  return {
    container: {
      controller,
      addEventListener: (type: string, fn: () => void) => {
        if (type === "controllerchange") listeners.push(fn);
      },
    } as unknown as ServiceWorkerContainer,
    fireControllerChange: () => listeners.forEach((fn) => fn()),
  };
}

describe("reloadOnWorkerReplacement", () => {
  it("reloads when a worker replaces the one that served this page", () => {
    const reload = vi.fn();
    const { container, fireControllerChange } = fakeContainer({});

    reloadOnWorkerReplacement(container, reload);
    fireControllerChange();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload on a first install", () => {
    /* No previous controller means no stale bundle to shed — reloading here
       would interrupt a first visit for nothing. */
    const reload = vi.fn();
    const { container, fireControllerChange } = fakeContainer(null);

    reloadOnWorkerReplacement(container, reload);
    fireControllerChange();

    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once even if the event fires again", () => {
    const reload = vi.fn();
    const { container, fireControllerChange } = fakeContainer({});

    reloadOnWorkerReplacement(container, reload);
    fireControllerChange();
    fireControllerChange();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does nothing where service workers are unavailable", () => {
    const reload = vi.fn();
    expect(() => reloadOnWorkerReplacement(undefined, reload)).not.toThrow();
    expect(reload).not.toHaveBeenCalled();
  });
});
