import assert from "node:assert/strict";
import test from "node:test";
import { MachinesService } from "./machines.service";

test("rejects a machine name that duplicates another machine regardless of letter case", async () => {
  const service = new MachinesService(
    {
      machine: {
        findFirst: async () => ({ id: 9, machine_code: "LOCAL09", machine_name: "M\u00e1yQu\u00e9t09" }),
        create: async () => {
          throw new Error("must not create a duplicate machine name");
        }
      }
    } as never,
    { write: async () => undefined } as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    () => service.createMachine({ machine_code: "LOCAL10", machine_name: "M\u00c1YQU\u00c9T09" }),
    (error: unknown) => {
      const response = error && typeof error === "object" && "getResponse" in error ? (error as { getResponse: () => { code?: string } }).getResponse() : null;
      return response?.code === "MACHINE_NAME_DUPLICATE";
    }
  );
});

test("rejects spaces and special characters in a machine name", async () => {
  const service = new MachinesService(
    {
      machine: {
        findFirst: async () => null,
        create: async () => {
          throw new Error("must not create an invalid machine name");
        }
      }
    } as never,
    { write: async () => undefined } as never,
    {} as never,
    {} as never
  );

  for (const machineName of ["M\u00e1y 01", "M\u00e1y_01", "M\u00e1y-01", " M\u00e1y01", "M\u00e1y01 "]) {
    await assert.rejects(
      () => service.createMachine({ machine_code: "LOCAL10", machine_name: machineName }),
      (error: unknown) => {
        const response = error && typeof error === "object" && "getResponse" in error ? (error as { getResponse: () => { code?: string } }).getResponse() : null;
        return response?.code === "MACHINE_NAME_INVALID";
      }
    );
  }
});

test("requires a non-empty line when creating a machine", async () => {
  const service = new MachinesService(
    {
      machine: {
        findFirst: async () => null,
        create: async () => {
          throw new Error("must not create a machine without a line");
        }
      }
    } as never,
    { write: async () => undefined } as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    () => service.createMachine({ machine_code: "LOCAL10", machine_name: "MayQuet10", line_name: "   " }),
    (error: unknown) => {
      const response = error && typeof error === "object" && "getResponse" in error ? (error as { getResponse: () => { code?: string } }).getResponse() : null;
      return response?.code === "PAYLOAD_INVALID";
    }
  );
});
